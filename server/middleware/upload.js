const multer = require("multer");
const path = require("node:path");
const AppError = require("../utils/AppError");
const { maxUploadBytes, maxJobDescriptionLength } = require("../../shared/constraints.json");
module.exports = multer({
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
