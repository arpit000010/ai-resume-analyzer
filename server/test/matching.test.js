const { test } = require("node:test");
const assert = require("node:assert/strict");
const { extractSkills, skillsList } = require("../utils/skillExtractor");
const match = require("../services/matchResume");
const roles = require("../data/roles.json");

test("aliases, case, punctuation and whitespace normalize to unique canonical skills", () => {
  assert.deepEqual(extractSkills("REACT.js ReactJS react Node.js JS PostgreSQL RESTful APIs data\nstructures"),
    ["javascript", "react", "node", "sql", "api", "data structures"]);
});
test("boundaries prevent substring and programming-language false positives", () => {
  assert.deepEqual(extractSkills("JavaScript GitHub NoSQL reaction expressiveness rapid CSS3"), ["javascript", "css", "github"]);
  assert.deepEqual(extractSkills("C++ C# cpp csharp"), ["c++", "c#"]);
  assert.deepEqual(extractSkills("C, Java; Git. CI/CD Next.js"), ["c", "java", "git", "ci/cd", "next.js"]);
  assert.deepEqual(extractSkills("éjava javaé x_python python_x"), []);
});
test("the same catalog supports all existing role definitions", () => {
  for (const skill of Object.values(roles).flat()) assert.ok(skillsList.includes(skill), skill);
  assert.equal(new Set(skillsList).size, skillsList.length);
});
test("baseline uses only unique recognized JD skills, without frequency weighting", () => {
  const result = match("React ReactJS Node.js Java Docker", "React ReactJS Nodejs Python");
  assert.deepEqual(result.matchedSkills, ["react", "node"]);
  assert.deepEqual(result.missingSkills, ["python"]);
  assert.equal(result.baselinePercentage, 67);
  assert.equal(result.scoring.requiredCount, 3);
  assert.match(result.suggestions.join(" "), /Do not claim/);
  assert.equal(match("", "React Python").baselinePercentage, 0);
  assert.equal(match("React", "React ReactJS").baselinePercentage, 100);
});
test("unknown JD skills return no score and actionable guidance", () => {
  const result = match("JavaScript", "Accountancy and bookkeeping experience");
  assert.equal(result.baselinePercentage, null);
  assert.deepEqual(result.jobSkills, []);
  assert.match(result.suggestions[0], /No skills/);
});
