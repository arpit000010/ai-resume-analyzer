const definitions = require("../../shared/skills.json");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// + and # are token characters, so C does not also match C++ or C#.
const patterns = definitions.map(({ name, aliases }) => ({
  name,
  pattern: new RegExp(
    `(?<![\\p{L}\\p{N}_+#.])(?:${[name, ...aliases]
      .map((alias) => escapeRegex(alias).replace(/\s+/g, "\\s+"))
      .join("|")})(?![\\p{L}\\p{N}_+#])`, "iu"
  ),
}));
const extractSkills = (text) => {
  const normalized = text.normalize("NFKC");
  return patterns.filter(({ pattern }) => pattern.test(normalized)).map(({ name }) => name);
};
module.exports = { extractSkills, skillsList: definitions.map(({ name }) => name) };
