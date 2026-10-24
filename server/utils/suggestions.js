module.exports = (missingSkills, score) => {
  if (score === null) return ["No skills from the supported catalog were found in this job description. Review the requirements manually or use a more detailed description."];
  const tips = missingSkills.length
    ? [`If you have experience with ${missingSkills.join(", ")}, add specific examples to your resume. Do not claim skills you have not used.`]
    : ["Your resume mentions every recognized job-description skill. Strengthen those mentions with concrete examples."];
  tips.push("Describe relevant projects and achievements with measurable outcomes.");
  if (score < 50) tips.push("Prioritize experience relevant to this job and identify skills to practice before applying.");
  return tips;
};
