const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const app = require("../app");
const { semanticMatch } = require("../services/semanticMatcher");
const makePdf = require("./helpers/pdf");

let api;
let nlp;
let base;
let behavior = "ok";
let lastInput;
const saved = { url: process.env.NLP_SERVICE_URL, timeout: process.env.NLP_TIMEOUT_MS, enabled: process.env.NLP_ENABLED };
const model = "sentence-transformers/all-MiniLM-L6-v2";
const fixture = () => ({
  status: "available", method: "passage-cosine-v1", model, revision: null,
  thresholds: { strong: 0.65, possible: 0.4 }, explanation: "Heuristic cosine similarity, not a percentage.",
  resumePassageCount: 1, requirementCount: 1,
  matches: [{ requirement: "React developer with Node.js and Python", similarity: 0.72, status: "strong",
    evidence: { text: "JavaScript React Node.js SQL", passageIndex: 0 } }],
});

before(async () => {
  nlp = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/health/ready") {
      res.statusCode = behavior === "error" ? 503 : 200;
      return res.end(JSON.stringify({ status: "ready", model }));
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    lastInput = JSON.parse(raw);
    if (behavior === "delay") { await new Promise((resolve) => setTimeout(resolve, 150)); }
    if (behavior === "error") { res.statusCode = 503; return res.end("{}"); }
    if (behavior === "input") { res.statusCode = 422; return res.end("{}"); }
    if (behavior === "unreadable") { res.statusCode = 422; return res.end(JSON.stringify({ error: { code: 'UNREADABLE_PASSAGES' } })); }
    if (behavior === "malformed") return res.end("{broken");
    if (behavior === "oversize") return res.end(JSON.stringify({ text: "x".repeat(260000) }));
    const result = fixture();
    if (behavior === "bad-score") result.matches[0].similarity = 72;
    if (behavior === "bad-status") result.matches[0].status = "weak";
    if (behavior === "bad-evidence") result.matches[0].evidence.passageIndex = 2;
    if (behavior.startsWith("hybrid")) {
      Object.assign(result, { analysisVersion: "hybrid-requirements-v2", excludedPassageCount: 4, warnings: [] });
      Object.assign(result.matches[0], { requirement: "React development", similarity: 0.1, status: "weak",
        category: "technical", priority: "required", hybridStatus: "supported", basis: "explicit_skills",
        matchedSkills: ["react"], missingSkills: [], uncertainty: ["Mentions do not prove proficiency."],
        skillEvidence: [{ skill: "react", text: "JavaScript React Node.js SQL", passageIndex: 0 }] });
      if (behavior === "hybrid-empty") { result.matches = []; result.requirementCount = 0; }
      if (behavior === "hybrid-bad") result.matches[0].hybridStatus = "qualified";
    }
    res.end(JSON.stringify(result));
  }).listen(0, "127.0.0.1");
  await once(nlp, "listening");
  process.env.NLP_SERVICE_URL = `http://127.0.0.1:${nlp.address().port}`;
  process.env.NLP_TIMEOUT_MS = "1000";
  process.env.NLP_ENABLED = "true";
  api = app.listen(0, "127.0.0.1");
  await once(api, "listening");
  base = `http://127.0.0.1:${api.address().port}`;
});
after(async () => {
  await Promise.all([api, nlp].filter(Boolean).map((server) => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); })));
  for (const [key, value] of [["NLP_SERVICE_URL", saved.url], ["NLP_TIMEOUT_MS", saved.timeout], ["NLP_ENABLED", saved.enabled]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

async function analyze() {
  const form = new FormData();
  form.append("resume", new Blob([makePdf()], { type: "application/pdf" }), "resume.pdf");
  form.append("jobDescription", "React developer with Node.js and Python");
  const response = await fetch(`${base}/api/analyze`, { method: "POST", body: form });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.baselinePercentage, 67);
  assert.deepEqual(body.matchedSkills, ["react", "node"]);
  assert.deepEqual(body.missingSkills, ["python"]);
  return body;
}

test("Express sends extracted PDF and actual JD, retaining separate keyword and semantic results", async () => {
  behavior = "ok";
  const body = await analyze();
  assert.deepEqual(body.semantic, fixture());
  assert.match(lastInput.resumeText, /JavaScript React Node.js SQL/);
  assert.equal(lastInput.jobDescription, "React developer with Node.js and Python");
  assert.equal(body.semantic.matches[0].similarity, 0.72);
});
test("service errors and invalid responses gracefully preserve the baseline", async () => {
  for (behavior of ["error", "input", "malformed", "oversize", "bad-score", "bad-status", "bad-evidence"]) {
    const body = await analyze();
    assert.equal(body.semantic.status, "unavailable", behavior);
    assert.equal(body.semantic.matches, undefined);
  }
});
test("timeout, cancellation, disabled mode, and input limits return explicit fallback reasons", async () => {
  behavior = "delay";
  process.env.NLP_TIMEOUT_MS = "20";
  assert.equal((await analyze()).semantic.reason, "timeout");
  process.env.NLP_TIMEOUT_MS = "1000";
  const abort = new AbortController(); abort.abort();
  assert.equal((await semanticMatch("resume", "description", { signal: abort.signal })).reason, "cancelled");
  process.env.NLP_ENABLED = "false";
  assert.equal((await analyze()).semantic.reason, "disabled");
  process.env.NLP_ENABLED = "true";
  assert.equal((await semanticMatch("x".repeat(60001), "description")).reason, "input_limit");
  behavior = "ok";
});
test("dependency readiness is independent of Express liveness", async () => {
  behavior = "ok";
  assert.equal((await fetch(`${base}/api/health/semantic`)).status, 200);
  behavior = "error";
  assert.equal((await fetch(`${base}/api/health/semantic`)).status, 503);
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
});
test("bad URL, invalid timeout and connection failure give keyword-only results", async () => {
  const url = process.env.NLP_SERVICE_URL;
  try {
    process.env.NLP_SERVICE_URL = "file:///tmp/model";
    assert.equal((await analyze()).semantic.reason, "configuration");
    process.env.NLP_SERVICE_URL = url;
    process.env.NLP_TIMEOUT_MS = "16000";
    assert.equal((await analyze()).semantic.reason, "configuration");
    process.env.NLP_TIMEOUT_MS = "1000";
    process.env.NLP_SERVICE_URL = "http://127.0.0.1:1";
    assert.equal((await analyze()).semantic.status, "unavailable");
  } finally {
    process.env.NLP_SERVICE_URL = url;
    process.env.NLP_TIMEOUT_MS = "1000";
  }
});
test("hybrid metadata and zero actionable requirements survive the Express boundary", async () => {
  behavior = "hybrid";
  const result = await analyze();
  assert.equal(result.semantic.analysisVersion, "hybrid-requirements-v2");
  assert.equal(result.semantic.matches[0].status, "weak");
  assert.equal(result.semantic.matches[0].hybridStatus, "supported");
  assert.equal(result.semantic.matches[0].skillEvidence[0].skill, "react");
  behavior = "hybrid-empty";
  assert.equal((await analyze()).semantic.requirementCount, 0);
  behavior = "hybrid-bad";
  assert.equal((await analyze()).semantic.status, "unavailable");
});
test('little usable resume text gets an actionable fallback without losing keyword results', async () => {
  behavior = 'unreadable';
  const result = await analyze();
  assert.equal(result.semantic.reason, 'insufficient_resume_text');
  assert.match(result.semantic.message, /usable work, skill, or education/);
});
