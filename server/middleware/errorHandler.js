const multer = require("multer");
const AppError = require("../utils/AppError");
module.exports = (err, req, res, next) => {
  if (req.file) delete req.file.buffer;
  if (res.headersSent) return next(err);
  if (res.destroyed) return;
  let status = err instanceof AppError ? err.status : 500;
  let code = err instanceof AppError ? err.code : "INTERNAL_ERROR";
  let message = err instanceof AppError ? err.message : "Analysis failed unexpectedly. Please try again.";
  if (err instanceof multer.MulterError) {
    status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    code = err.code;
    message = err.code === "LIMIT_FILE_SIZE" ? "The resume must be 5 MiB or smaller." : "Send one PDF in the resume field and one jobDescription text field within the size limits.";
  } else if (!(err instanceof AppError) && /^(Unexpected end of (form|file)|Malformed (part header|content type)|Multipart: Boundary not found)/.test(err.message)) {
    status = 400; code = "INVALID_MULTIPART"; message = "The upload was incomplete or malformed. Please try again.";
  }
  if (status === 500) console.error("Unexpected analysis error:", err.name);
  res.status(status).json({ success: false, error: { code, message } });
};
