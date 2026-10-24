import { test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { validateInputs, analyzeResume } from "../src/lib/analyzer.js";

const jd = "React developer with Node.js experience";
const file = new File(["%PDF-test"], "resume.pdf", { type: "application/pdf" });
test("client validates missing, wrong, empty and oversized files plus JD bounds", () => {
  assert.match(validateInputs(null, jd), /Upload/);
  assert.match(validateInputs({ name: "a.txt" }, jd), /Only PDF/);
  assert.match(validateInputs({ name: "a.pdf", type: "text/plain" }, jd), /Only PDF/);
  assert.match(validateInputs({ name: "a.pdf", size: 0 }, jd), /empty/);
  assert.match(validateInputs({ name: "a.pdf", size: 5242881 }, jd), /5 MiB/);
  assert.match(validateInputs(file, "short"), /job description/);
  assert.match(validateInputs(file, "x".repeat(20001)), /job description/);
  assert.equal(validateInputs(file, jd), "");
});
test("client sends PDF and actual JD as multipart without setting a boundary", async () => {
  const previous = axios.defaults.adapter;
  axios.defaults.adapter = async (config) => {
    assert.equal(config.url, "/api/analyze");
    assert.equal(config.data.get("resume").name, "resume.pdf");
    assert.equal(config.data.get("jobDescription"), jd);
    assert.equal(config.timeout, 30000);
    return { data: { baselinePercentage: 50 }, status: 200, headers: {}, config };
  };
  try { assert.equal((await analyzeResume(file, jd)).baselinePercentage, 50); }
  finally { axios.defaults.adapter = previous; }
});
test("client surfaces server errors and gives network and timeout guidance", async () => {
  const previous = axios.defaults.adapter;
  try {
    for (const [error, expected] of [
      [{ response: { data: { error: { message: "No readable text" } } } }, /No readable text/],
      [{ code: "ECONNABORTED" }, /timed out/],
      [{ code: "ERR_NETWORK" }, /local server/],
    ]) {
      axios.defaults.adapter = async () => { throw error; };
      await assert.rejects(analyzeResume(file, jd), expected);
    }
  } finally { axios.defaults.adapter = previous; }
});
