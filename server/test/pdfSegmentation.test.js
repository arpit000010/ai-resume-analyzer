const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePdfText, renderTextItems } = require('../utils/pdfText');
const extractText = require('../utils/extractText');
const makePdf = require('./helpers/pdf');
const item = (str, x, y, width = str.length * 6) => ({ str, width, transform: [12, 0, 0, 12, x, y] });

test('PDF geometry preserves word spaces, bullets and section boundaries', () => {
  const text = renderTextItems([
    item('SKILLS', 50, 750), item('C/C++', 50, 725), item('Linux', 90, 725),
    item('EXPERIENCE', 50, 680), item('• Built drivers.', 50, 655), item('• Led events.', 50, 630),
  ]);
  assert.match(text, /C\/C\+\+ Linux/);
  assert.match(text, /Linux\n\nEXPERIENCE\n\n• Built drivers\./);
  assert.match(text, /drivers\.\n\n• Led/);
});
test('PDF word pieces concatenate while positional gaps become spaces or boundaries', () => {
  assert.equal(renderTextItems([item('Java', 0, 10, 24), item('Script', 24, 10, 36)]), 'JavaScript');
  assert.equal(renderTextItems([item('Python', 0, 10), item('Docker', 44, 10)]), 'Python Docker');
  assert.equal(renderTextItems([item('Left column', 0, 10), item('Right column', 350, 10)]), 'Left column\n\nRight column');
});
test('normalization repairs soft wraps and ligatures without deleting C/C++ or bullet boundaries', () => {
  assert.equal(normalizePdfText('  C/C++\r\n● Efﬁcient inter-\nnal tools\u0000\n\n\nEDUCATION\nBSc '), 'C/C++\n• Efficient internal tools\n\nEDUCATION\n\nBSc');
});
test('actual PDF parsing retains sections and distinct project bullets', async () => {
  const text = await extractText(makePdf(['SKILLS', 'C/C++ and Linux', 'EXPERIENCE', '- Built device drivers.', '- Led volunteer events.', 'EDUCATION', 'Bachelor of Science']));
  assert.match(text, /SKILLS\n\nC\/C\+\+ and Linux\n\nEXPERIENCE/);
  assert.match(text, /drivers\.\n\n- Led volunteer/);
});
