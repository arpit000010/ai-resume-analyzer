const extractText = require("../utils/extractText");
const matchResume = require("../services/matchResume");
const AppError = require("../utils/AppError");
const { minJobDescriptionLength, maxJobDescriptionLength } = require("../../shared/constraints.json");
const analyzeResume = async (req, res) => {
  const abort = new AbortController();
  const onClose = () => { if (!res.writableEnded) abort.abort(); };
  res.once("close", onClose);
  try {
    if (!req.file) throw new AppError(400, "RESUME_REQUIRED", "Upload a PDF resume.");
    const { jobDescription } = req.body;
    if (Object.keys(req.body).some((key) => key !== "jobDescription")) {
      throw new AppError(400, "INVALID_FIELDS", "Only the jobDescription text field is supported.");
    }
    if (typeof jobDescription !== "string" || jobDescription.trim().length < minJobDescriptionLength || jobDescription.length > maxJobDescriptionLength) {
      throw new AppError(400, "INVALID_JOB_DESCRIPTION", `Provide a job description of ${minJobDescriptionLength}–${maxJobDescriptionLength} characters.`);
    }
    if (req.file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new AppError(415, "INVALID_PDF", "The uploaded file is not a valid PDF.");
    }
    const resumeText = await extractText(req.file.buffer, { signal: abort.signal });
    res.json({ success: true, ...matchResume(resumeText, jobDescription) });
  } finally {
    res.removeListener("close", onClose);
    // No resume files are written to disk; release the request buffer.
    if (req.file) delete req.file.buffer;
  }
};
module.exports = { analyzeResume };
