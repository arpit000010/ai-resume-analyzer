const extractText = require("../utils/extractText");
const matchResume = require("./matchResume");
const { semanticMatch } = require("./semanticMatcher");
const recommendations = require('./recommendations');
module.exports = async (buffer, jobDescription, signal) => {
  const resumeText = await extractText(buffer, { signal });
  const baseline = matchResume(resumeText, jobDescription);
  const semantic = await semanticMatch(resumeText, jobDescription, { signal });
  return { success: true, ...baseline, suggestions: recommendations(semantic), semantic };
};
