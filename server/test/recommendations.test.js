const { test } = require('node:test');
const assert = require('node:assert/strict');
const recommend = require('../services/recommendations');
const item = (requirement, priority, evidenceKind = 'uncertain') => ({ requirement, priority, evidenceKind, category: 'technical' });
test('public API suggestions do not recommend unused OR alternatives or company names', () => {
  const result = recommend({ status: 'available', matches: [{ ...item('Knowledge of Python OR Perl', 'required', 'explicit'), missingSkills: [], alternativeSkills: ['perl'] }] });
  assert.doesNotMatch(result.join(' '), /perl|aws|nvidia/i);
  assert.match(result.join(' '), /do not establish proficiency/);
});
test('required gaps precede preferred gaps and optional conditions are excluded', () => {
  const result = recommend({ status: 'available', matches: [item('Optional CUDA', 'optional'), item('Preferred Linux', 'preferred'), item('Required Python', 'required')] });
  assert.equal(result.length, 2);
  assert.match(result[0], /^Required: Required Python/);
  assert.doesNotMatch(result.join(' '), /Optional CUDA/);
});
test('empty extraction and unavailable NLP produce useful manual-review feedback', () => {
  assert.match(recommend({ status: 'available', matches: [] })[0], /No actionable requirements/);
  assert.match(recommend({ status: 'unavailable' })[0], /review the qualification sections manually/);
});
test('education and duration suggestions do not invent qualifications', () => {
  const result = recommend({ status: 'available', matches: [{ ...item('B.Tech CSE', 'required'), category: 'education' }, { ...item('5 years of experience', 'required'), category: 'experience' }] });
  assert.match(result[0], /completion status/);
  assert.match(result[1], /does not establish the requested years/);
});
