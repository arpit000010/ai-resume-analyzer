const { Worker } = require("node:worker_threads");
const path = require("node:path");
const AppError = require("./AppError");
module.exports = (buffer, { timeoutMs = 10000, signal } = {}) => new Promise((resolve, reject) => {
  const worker = new Worker(path.join(__dirname, "pdfWorker.js"), {
    workerData: buffer,
    resourceLimits: { maxOldGenerationSizeMb: 128 },
  });
  let settled = false;
  const finish = (error, text) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    void worker.terminate();
    if (error) reject(error);
    else resolve(text);
  };
  const onAbort = () => finish(new AppError(499, "REQUEST_ABORTED", "Analysis cancelled."));
  const invalidPdf = () => new AppError(422, "PDF_PARSE_FAILED", "This PDF could not be read. It may be damaged or password-protected. Export an unlocked, text-based PDF and try again.");
  const timer = setTimeout(() => finish(new AppError(422, "PDF_TIMEOUT", "This PDF took too long to read. Try a simpler text-based PDF.")), timeoutMs);
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) onAbort();
  worker.once("message", (result) => {
    if (result.failed) return finish(invalidPdf());
    if (!result.text || !/[\p{L}\p{N}]/u.test(result.text)) {
      return finish(new AppError(422, "PDF_UNREADABLE", "No readable text was found. Scanned or image-only resumes need OCR first; upload a text-based PDF."));
    }
    finish(null, result.text);
  });
  worker.once("error", () => finish(invalidPdf()));
  worker.once("exit", () => { if (!settled) finish(invalidPdf()); });
});
