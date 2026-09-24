const getSuggestions = (missingSkills, jdScore) => {
  const tips = [];

  if (jdScore < 50)
    tips.push("Your JD match is low. Add more job-relevant skills.");

  if (missingSkills.includes("react"))
    tips.push("Add at least one React project.");

  if (missingSkills.includes("node"))
    tips.push("Mention backend experience using Node.js.");

  if (missingSkills.length > 3)
    tips.push("Tailor your resume specifically for this role.");

  return tips;
};

module.exports = getSuggestions;
