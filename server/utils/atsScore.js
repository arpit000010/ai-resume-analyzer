module.exports = (matchedSkills, requiredSkills) => requiredSkills.length
  ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
  : null;
