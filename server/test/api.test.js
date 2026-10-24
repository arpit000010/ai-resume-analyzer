const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const http = require("node:http");
const { once } = require("node:events");
const makePdf = require("./helpers/pdf");
const { maxUploadBytes } = require("../../shared/constraints.json");
let server;
let url;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });
function form({ pdf = makePdf(), name = "resume.pdf", type = "application/pdf", jd = "React developer with Node.js and Python", field = "resume" } = {}) {
  const body = new FormData();
  if (pdf !== null) body.append(field, new Blob([pdf], { type }), name);
  if (jd !== null) body.append("jobDescription", jd);
  return body;
}
async function post(body) {
  const response = await fetch(`${url}/api/analyze`, { method: "POST", body });
  return { status: response.status, body: await response.json() };
}
test("health, JSON 404 and CORS rejection", async () => {
  const health = await fetch(`${url}/api/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-powered-by"), null);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.equal((await fetch(`${url}/missing`)).status, 404);
  assert.equal((await fetch(`${url}/api/health`, { headers: { Origin: "https://untrusted.example" } })).status, 403);
  const allowed = await fetch(`${url}/api/health`, { headers: { Origin: "http://localhost:5173" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
});
test("real multipart PDF and actual JD return a transparent baseline", async () => {
  const result = await post(form());
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.baselinePercentage, 67);
  assert.deepEqual(result.body.matchedSkills, ["react", "node"]);
  assert.deepEqual(result.body.missingSkills, ["python"]);
  assert.equal(result.body.scoring.requiredCount, 3);
});
test("invalid upload and JD cases return structured 4xx errors", async () => {
  const cases = [
    [{ pdf: null }, 400, "RESUME_REQUIRED"],
    [{ jd: null }, 400, "INVALID_JOB_DESCRIPTION"],
    [{ jd: "  " }, 400, "INVALID_JOB_DESCRIPTION"],
    [{ jd: "x".repeat(20001) }, 400, "INVALID_JOB_DESCRIPTION"],
    [{ name: "resume.docx" }, 415, "PDF_ONLY"],
    [{ type: "text/plain" }, 415, "PDF_ONLY"],
    [{ pdf: Buffer.from("not a PDF") }, 415, "INVALID_PDF"],
    [{ pdf: Buffer.from("%PDF-1.4 broken") }, 422, "PDF_PARSE_FAILED"],
    [{ pdf: makePdf("") }, 422, "PDF_UNREADABLE"],
    [{ pdf: Buffer.alloc(maxUploadBytes + 1) }, 413, "LIMIT_FILE_SIZE"],
    [{ field: "unexpected" }, 400, "LIMIT_UNEXPECTED_FILE"],
  ];
  for (const [input, status, code] of cases) {
    const result = await post(form(input));
    assert.equal(result.status, status, JSON.stringify(result));
    assert.equal(result.body.error.code, code);
    assert.equal(result.body.success, false);
  }
});
test("extra fields, duplicate files and malformed multipart are rejected", async () => {
  const extra = form(); extra.append("selectedRole", "frontend developer");
  assert.equal((await post(extra)).status, 400);
  const duplicate = form(); duplicate.append("resume", new Blob([makePdf()], { type: "application/pdf" }), "other.pdf");
  assert.equal((await post(duplicate)).status, 400);
  const malformed = await fetch(`${url}/api/analyze`, { method: "POST", headers: { "Content-Type": "multipart/form-data" }, body: "broken" });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, "INVALID_MULTIPART");
  assert.equal((await post(JSON.stringify({}))).status, 415);
});
test("unrecognized JD gets null score rather than misleading zero", async () => {
  const result = await post(form({ jd: "Accountancy and bookkeeping experience required" }));
  assert.equal(result.status, 200);
  assert.equal(result.body.baselinePercentage, null);
});
test("concurrent uploads are bounded and aborted uploads release capacity", async () => {
  const held = [];
  try {
    for (let index = 0; index < 2; index++) {
      const request = http.request(`${url}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=held", "Content-Length": "10000" },
      });
      request.on("error", () => {});
      request.flushHeaders();
      await once(request, "socket").then(([socket]) => socket.connecting ? once(socket, "connect") : null);
      request.write("--held\r\nContent-Disposition: form-data; name=\"jobDescription\"\r\n\r\n");
      held.push(request);
    }
    await fetch(`${url}/api/health`);
    const busy = await post(form());
    assert.equal(busy.status, 503);
    assert.equal(busy.body.error.code, "SERVER_BUSY");
  } finally {
    for (const request of held) request.destroy();
  }
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal((await post(form())).status, 200);
});
