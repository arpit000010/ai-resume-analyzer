const calculateATSScore = (foundSkills, totalSkills) => {
  return Math.round((foundSkills.length / totalSkills.length) * 100);
};

module.exports = calculateATSScore;
