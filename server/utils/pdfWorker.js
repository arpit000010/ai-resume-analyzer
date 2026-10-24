const { parentPort, workerData } = require("node:worker_threads");
const pdfjs = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
// Disable PDF.js dynamic code generation for untrusted documents.
pdfjs.PDFJS.isEvalSupported = false;
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
// PDF.js expects Uint8Array slicing semantics; Buffer.slice shares storage.
pdfParse(new Uint8Array(workerData)).then(
  ({ text }) => parentPort.postMessage({ text }),
  () => parentPort.postMessage({ failed: true })
);
