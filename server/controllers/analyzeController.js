const extractText = require("../utils/extractText");
const cleanText = require("../utils/cleanText");
const { extractSkills } = require("../utils/skillExtractor");
const detectRole = require("../utils/roleDetector");
const roles = require("../data/roles.json");
const getSuggestions = require("../utils/suggestions");

const analyzeResume = async (req, res) => {
  try {
    const filePath = req.file.path;
    const { selectedRole } = req.body;

    // Resume processing
    const resumeText = cleanText(await extractText(filePath));
    const resumeSkills = extractSkills(resumeText);

    // Role-based JD skills
    const jdSkills = roles[selectedRole] || [];

    const matchedSkills = jdSkills.filter(skill =>
      resumeSkills.includes(skill)
    );

    const missingJDSkills = jdSkills.filter(skill =>
      !resumeSkills.includes(skill)
    );

    const jdMatchScore = jdSkills.length
      ? Math.round((matchedSkills.length / jdSkills.length) * 100)
      : 0;

    const suggestions = getSuggestions(missingJDSkills, jdMatchScore);

    res.json({
      success: true,
      selectedRole,
      jdMatchScore,
      resumeSkills,
      matchedSkills,
      missingJDSkills,
      suggestions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
};

module.exports = { analyzeResume };
