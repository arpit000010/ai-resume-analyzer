const cleanText = (text) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9+.#\s]/g, "")
    .trim();
};

module.exports = cleanText;
