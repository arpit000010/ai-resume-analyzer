const skillsMap = {
  c: ["c"],
  "c++": ["c++", "cpp"],
  java: ["java"],
  python: ["python"],
  javascript: ["javascript", "js"],
  react: ["react", "reactjs"],
  node: ["node", "nodejs"],
  express: ["express"],
  mongodb: ["mongodb", "mongo"],
  sql: ["sql", "mysql"],
  html: ["html"],
  css: ["css"],
  tailwind: ["tailwind", "tailwind css"],
  bootstrap: ["bootstrap"],
  git: ["git"],
  github: ["github"],
  api: ["api", "apis"],
  "data structures": ["dsa", "data structures"],
  algorithms: ["algorithms"]
};

const skillsList = Object.keys(skillsMap);

const extractSkills = (text) => {
  const found = [];

  for (const skill in skillsMap) {
    for (const alias of skillsMap[skill]) {
      if (text.includes(alias)) {
        found.push(skill);
        break;
      }
    }
  }
  return found;
};

module.exports = { extractSkills, skillsList };
