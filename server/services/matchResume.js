const { extractSkills } = require("../utils/skillExtractor");
const calculateScore = require("../utils/atsScore");
const getSuggestions = require("../utils/suggestions");
// Pure service boundary for a future NLP adapter.
module.exports = (resumeText, jobDescription) => {
  const resumeSkills = extractSkills(resumeText);
  const jobSkills = extractSkills(jobDescription);
  const matchedSkills = jobSkills.filter((skill) => resumeSkills.includes(skill));
  const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill));
  const baselinePercentage = calculateScore(matchedSkills, jobSkills);
  return {
    method: "skill-overlap-v1", resumeSkills, jobSkills, matchedSkills, missingSkills,
    baselinePercentage,
    scoring: {
      matchedCount: matchedSkills.length,
      requiredCount: jobSkills.length,
      formula: "round(matched unique skills / recognized unique job skills × 100)",
      explanation: "Equal-weight keyword coverage using the shared skill catalog and aliases. Mentions do not prove proficiency. Context, negation, experience, and requirements outside the catalog are not evaluated. This is not an ATS or hiring prediction.",
    },
    suggestions: getSuggestions(missingSkills, baselinePercentage),
  };
};
