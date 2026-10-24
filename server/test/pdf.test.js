const { test } = require("node:test");
const assert = require("node:assert/strict");
const extractText = require("../utils/extractText");
const makePdf = require("./helpers/pdf");
const { analyzeResume } = require("../controllers/analyzeController");
const { EventEmitter } = require("node:events");

test("real PDF text extraction", async () => {
  assert.match(await extractText(makePdf()), /JavaScript React Node.js SQL/);
});
test("corrupt and blank PDFs produce actionable errors", async () => {
  await assert.rejects(extractText(Buffer.from("%PDF-1.4\nbroken")), { code: "PDF_PARSE_FAILED", status: 422 });
  await assert.rejects(extractText(makePdf("")), { code: "PDF_UNREADABLE", status: 422 });
});
test("parser timeout and cancellation terminate workers", async () => {
  await assert.rejects(extractText(makePdf(), { timeoutMs: 1 }), { code: "PDF_TIMEOUT" });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(extractText(makePdf(), { signal: controller.signal }), { code: "REQUEST_ABORTED" });
});
test("request file buffer is released on validation, parse failure and success", async () => {
  for (const [buffer, jobDescription] of [[makePdf(), "short"], [Buffer.from("%PDF-broken"), "React developer with Python"], [makePdf(), "React developer with Python"]]) {
    const req = { file: { buffer }, body: { jobDescription } };
    const res = new EventEmitter();
    res.json = () => {};
    try { await analyzeResume(req, res); } catch (error) { assert.ok(error.status < 500); }
    assert.equal(req.file.buffer, undefined);
    assert.equal(res.listenerCount("close"), 0);
  }
});
