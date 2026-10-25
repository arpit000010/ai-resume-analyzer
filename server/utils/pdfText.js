const SECTION = /^(?:summary|profile|technical skills|skills|experience|work experience|professional experience|education|projects|certifications|publications|achievements)$/i;

function normalizePdfText(text) {
  return text.normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000\u200B\uFEFF]/g, "")
    .replace(/\u00ad/g, "")
    .replace(/(\p{L})-\n(?=\p{Ll})/gu, "$1")
    .split("\n")
    .map((line) => {
      const clean = line.replace(/[\t ]+/g, " ").trim();
      if (SECTION.test(clean.replace(/:$/, ""))) return `\n${clean}\n`;
      return clean.replace(/^[●▪◦]\s*/, "• ");
    }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Reconstruct spaces from PDF positions instead of concatenating text items.
// Large same-row gaps remain separate blocks to reduce column/section merging.
function renderTextItems(items) {
  const rows = [];
  for (const item of items) {
    if (!item.str || !Array.isArray(item.transform)) continue;
    const x = item.transform[4], y = item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ ...item, x });
  }
  rows.sort((a, b) => b.y - a.y);
  let output = "", previousRow;
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    const height = Math.max(8, ...row.items.map((item) => Math.abs(item.transform[3]) || item.height || 12));
    if (previousRow) output += previousRow.y - row.y > height * 1.6 ? "\n\n" : "\n";
    let previous;
    for (const item of row.items) {
      if (previous) {
        const width = previous.width || previous.str.length * height * 0.45;
        const gap = item.x - (previous.x + width);
        if (gap > Math.max(40, height * 3)) output += "\n\n";
        else if (gap > height * 0.15 && !/\s$/.test(previous.str) && !/^\s/.test(item.str)) output += " ";
      }
      output += item.str;
      previous = item;
    }
    previousRow = row;
  }
  return normalizePdfText(output);
}

module.exports = { normalizePdfText, renderTextItems };
