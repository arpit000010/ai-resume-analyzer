const { test } = require('node:test');
const assert = require('node:assert/strict');
const validate = require('../validators/semanticResponse');
const { extractSkills } = require('../utils/skillExtractor');
const result = () => ({
  status: 'available', method: 'passage-cosine-v1', analysisVersion: 'hybrid-requirements-v2', model: 'sentence-transformers/all-MiniLM-L6-v2', revision: null,
  thresholds: { strong: 0.65, possible: 0.4 }, explanation: 'Explicit evidence is not proficiency.', requirementCount: 1, resumePassageCount: 1, excludedPassageCount: 2, warnings: [],
  matches: [{ requirement: 'Knowledge of Python OR Perl', similarity: 0.1, status: 'weak', hybridStatus: 'supported', evidenceKind: 'explicit', basis: 'explicit_skills', category: 'technical', priority: 'required', sourceSection: 'Required qualifications', extractionConfidence: 'explicit',
    matchedSkills: ['python'], missingSkills: [], alternativeSkills: ['perl'], skillConditions: [{ anyOf: ['python', 'perl'], matched: ['python'], satisfied: true }], uncertainty: ['Self-reported only.'],
    skillEvidence: [{ skill: 'python', text: 'Skills: Python', passageIndex: 0, section: 'skills' }], evidence: { text: 'Skills: Python', passageIndex: 0, section: 'skills', relevant: true } }],
});

test('final evidence kind, OR conditions, and resume sections survive contract validation', () => {
  assert.deepEqual(validate(result()), result());
});
test('contradictory classifications and false missing OR alternatives are rejected', () => {
  for (const corrupt of [
    (m) => { m.hybridStatus = 'missing'; },
    (m) => { m.missingSkills = ['perl']; },
    (m) => { m.skillConditions[0].satisfied = false; },
    (m) => { m.evidence.relevant = false; },
    (m) => { m.evidenceKind = 'officially_qualified'; },
  ]) {
    const payload = result(); corrupt(payload.matches[0]);
    assert.throws(() => validate(payload));
  }
});
test('optional conditions and explicit education mentions remain additive to the API', () => {
  const payload = result();
  Object.assign(payload.matches[0], { requirement: 'B.Tech Computer Science eligibility', category: 'education', priority: 'optional', basis: 'explicit_education', matchedSkills: [], alternativeSkills: [], skillConditions: [], skillEvidence: [], evidence: { text: 'B.Tech CSE', passageIndex: 0, section: 'education', relevant: true } });
  assert.equal(validate(payload).matches[0].basis, 'explicit_education');
});
test('the shared taxonomy detects systems aliases identically in Node', () => {
  assert.deepEqual(new Set(extractSkills('C, C++, Python, Operating Systems, DSA, OOP')), new Set(['c', 'c++', 'python', 'operating systems', 'data structures', 'algorithms', 'object-oriented programming']));
  assert.deepEqual(extractSkills('Python OR Perl'), ['python', 'perl']);
});
