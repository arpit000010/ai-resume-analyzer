const { parentPort, workerData } = require("node:worker_threads");
const pdfjs = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
// Disable PDF.js dynamic code generation for untrusted documents.
pdfjs.PDFJS.isEvalSupported = false;
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const { renderTextItems, normalizePdfText } = require("./pdfText");
let renderedPages = 0;
let pageFailed = false;
// PDF.js expects Uint8Array slicing semantics; Buffer.slice shares storage.
pdfParse(new Uint8Array(workerData), {
  pagerender: async (page) => {
    try {
      const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: true });
      renderedPages += 1;
      return renderTextItems(content.items);
    } catch (error) { pageFailed = true; throw error; }
  },
}).then(
  ({ text, numpages }) => parentPort.postMessage(pageFailed || renderedPages !== numpages
    ? { failed: true } : { text: normalizePdfText(text) }),
  () => parentPort.postMessage({ failed: true })
);
