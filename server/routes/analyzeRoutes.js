const express = require("express");
const multer = require("multer");
const path = require("node:path");
const AppError = require("../utils/AppError");
const { maxUploadBytes, maxJobDescriptionLength } = require("../../shared/constraints.json");
const { analyzeResume } = require("../controllers/analyzeController");
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Busboy emits partsLimit as soon as the counter reaches this value.
    // files/fields enforce the exact one-file/one-field contract below it.
    fileSize: maxUploadBytes, files: 1, fields: 1, parts: 3,
    fieldSize: maxJobDescriptionLength * 4, fieldNameSize: 100,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf" || path.extname(file.originalname).toLowerCase() !== ".pdf") {
      return cb(new AppError(415, "PDF_ONLY", "Only PDF resumes (.pdf) are accepted."));
    }
    cb(null, true);
  },
});
// Bound concurrent uploads and parser workers before accepting file bytes.
let active = 0;
router.post("/", (req, res, next) => {
  if (!req.is("multipart/form-data")) return next(new AppError(415, "MULTIPART_REQUIRED", "Send a PDF resume and jobDescription using multipart/form-data."));
  if (active >= 2) return next(new AppError(503, "SERVER_BUSY", "The analyzer is busy. Please try again shortly."));
  active += 1;
  let released = false;
  const release = () => { if (!released) { active -= 1; released = true; } };
  res.once("finish", release);
  res.once("close", release);
  next();
}, upload.single("resume"), analyzeResume);
module.exports = router;
