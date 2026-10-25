const validateInput = require("../validators/analyzeInput");
const analyze = require("../services/analyzeResume");
const analyzeResume = async (req, res) => {
  const abort = new AbortController();
  const onClose = () => { if (!res.writableEnded) abort.abort(); };
  res.once("close", onClose);
  try {
    const jobDescription = validateInput(req);
    const result = await analyze(req.file.buffer, jobDescription, abort.signal);
    if (!abort.signal.aborted) res.json(result);
  } finally {
    res.removeListener("close", onClose);
    // No resume files are written to disk; release the request buffer.
    if (req.file) delete req.file.buffer;
  }
};
module.exports = { analyzeResume };
