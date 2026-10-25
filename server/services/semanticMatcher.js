const validate = require("../validators/semanticResponse");
const { semanticConfig: configuration } = require("../config");
const MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const MAX_RESPONSE_BYTES = 250000;
const fallbackMessages = {
  disabled: "Semantic analysis is disabled. Keyword skill coverage is still shown.",
  input_limit: "This document exceeds the semantic text or passage limits. Try shorter documents. Keyword skill coverage is still shown.",
  timeout: "Semantic analysis timed out. Try shorter documents or retry after the local service is ready. Keyword skill coverage is still shown.",
  insufficient_resume_text: "The resume has little usable work, skill, or education text after removing headings and contact details. Upload a text-based resume with substantive evidence. Keyword coverage is still shown.",
};
const unavailable = (reason) => ({
  status: "unavailable", reason,
  message: fallbackMessages[reason] || "Semantic analysis is unavailable. Keyword skill coverage is still shown. Check the local NLP service and model readiness.",
});


async function readJson(response) {
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid NLP response type");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > MAX_RESPONSE_BYTES) throw new Error("NLP response too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}


async function semanticMatch(resumeText, jobDescription, { signal } = {}) {
  if (process.env.NLP_ENABLED === "false") return unavailable("disabled");
  if (resumeText.length > 60000) return unavailable("input_limit");
  let config;
  try { config = configuration(); } catch { return unavailable("configuration"); }
  const timeout = AbortSignal.timeout(config.timeout);
  try {
    const response = await fetch(`${config.base}/match`, {
      method: "POST", redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText, jobDescription }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) {
      if (response.status === 422) {
        const error = await readJson(response);
        return unavailable(error.error?.code === 'UNREADABLE_PASSAGES' ? 'insufficient_resume_text' : 'input_limit');
      }
      await response.body?.cancel();
      return unavailable(response.status === 422 || response.status === 413 ? "input_limit" : "service_error");
    }
    return validate(await readJson(response));
  } catch {
    return unavailable(signal?.aborted ? "cancelled" : timeout.aborted ? "timeout" : "connection_or_response");
  }
}

async function semanticHealth() {
  if (process.env.NLP_ENABLED === "false") return unavailable("disabled");
  try {
    const { base, timeout } = configuration();
    const response = await fetch(`${base}/health/ready`, { redirect: "error", signal: AbortSignal.timeout(Math.min(timeout, 1000)) });
    if (!response.ok) { await response.body?.cancel(); return unavailable("model_not_ready"); }
    const result = await readJson(response);
    if (result.status !== "ready" || result.model !== MODEL) return unavailable("invalid_response");
    return { status: "ready", model: MODEL };
  } catch { return unavailable("connection_or_response"); }
}

module.exports = { semanticMatch, semanticHealth };
