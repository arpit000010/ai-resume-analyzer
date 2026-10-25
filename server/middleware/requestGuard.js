const AppError = require("../utils/AppError");
let active = 0;
module.exports = (req, res, next) => {
  if (!req.is("multipart/form-data")) return next(new AppError(415, "MULTIPART_REQUIRED", "Send a PDF resume and jobDescription using multipart/form-data."));
  if (active >= 2) return next(new AppError(503, "SERVER_BUSY", "The analyzer is busy. Please try again shortly."));
  active += 1;
  let released = false;
  const release = () => { if (!released) { active -= 1; released = true; } };
  res.once("finish", release);
  res.once("close", release);
  next();
};
