import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { summarize, improvements, groupRequirements, finalSummary, evidenceGroups, skillGapGroups } from '../src/utils/results.js';

// Reuse Vite's existing JSX compiler; no browser/test framework dependency.
const built = buildSync({ stdin: { contents: `
export { default as Dashboard } from './src/components/analysis/ResultsDashboard.jsx';
export { default as State } from './src/components/analysis/AnalysisState.jsx';
export { default as Form } from './src/components/forms/AnalysisForm.jsx';
export { default as Groups } from './src/components/analysis/RequirementGroups.jsx';
`, resolveDir: fileURLToPath(new URL('..', import.meta.url)) }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react-dom', 'react/jsx-runtime'], write: false });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { Dashboard, State, Form, Groups } = compiled.exports;
const render = (component, props) => renderToStaticMarkup(createElement(component, props));
const match = { requirement: 'Programming with C/C++', category: 'technical', priority: 'required', status: 'weak', similarity: 0.1, hybridStatus: 'supported', basis: 'explicit_skills', evidence: { text: 'Built C/C++ drivers.', passageIndex: 0 }, uncertainty: ['Mentions do not prove proficiency.'], matchedSkills: ['c', 'c++'], missingSkills: [], skillEvidence: [] };
const data = { baselinePercentage: 67, matchedSkills: ['c', 'c++'], missingSkills: ['cuda'], jobSkills: ['c', 'c++', 'cuda'], scoring: { matchedCount: 2, requiredCount: 3, formula: '2 / 3 × 100', explanation: 'Keyword coverage only.' }, semantic: { status: 'available', requirementCount: 1, resumePassageCount: 1, matches: [match], explanation: 'Hybrid evidence rules', model: 'all-MiniLM-L6-v2', excludedPassageCount: 3 } };

test('frontend renders empty, loading and accessible error states without fake analytics', () => {
  assert.match(render(State, {}), /Add your resume/);
  assert.match(render(State, { loading: true }), /role="status"/);
  assert.match(render(State, { error: 'Unreadable PDF' }), /role="alert"/);
  assert.match(render(State, { error: 'Unreadable PDF' }), /Unreadable PDF/);
  assert.equal(render(State, { hasData: true }), '');
});
test('hybrid dashboard keeps keyword percentages separate and details collapsed', () => {
  const html = render(Dashboard, { data });
  assert.match(html, /aria-valuenow="67"/);
  assert.match(html, /Direct mentions/);
  assert.match(html, /Partial \/ contextual/);
  assert.match(html, /Needs verification/);
  assert.match(html, /Not evidenced/);
  assert.match(html, /Technical skills/);
  assert.match(html, /<details class="requirement-group">/);
  assert.match(html, /<details class="evidence-details">/);
  assert.match(html, /<details class="technical-details">/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /Built C\/C\+\+ drivers/);
  assert.deepEqual(summarize(data.semantic), { supported: 1, uncertain: 0, missing: 0 });
});
test('fallback, zero requirements and unknown keyword score render honestly', () => {
  const fallback = render(Dashboard, { data: { ...data, baselinePercentage: null, semantic: { status: 'unavailable', message: 'Local NLP service is stopped.' } } });
  assert.match(fallback, /Local NLP service is stopped/);
  assert.match(fallback, /Keyword-only analysis/);
  assert.doesNotMatch(fallback, /role="progressbar"/);
  assert.match(render(Groups, { semantic: { ...data.semantic, matches: [], requirementCount: 0 } }), /No actionable requirements/);
});
test('preferred gaps follow required gaps and old semantic results stay uncertain', () => {
  const preferred = { ...match, requirement: 'Optional CUDA knowledge', priority: 'preferred', hybridStatus: 'missing' };
  const required = { ...match, requirement: 'Required Python experience', priority: 'required', hybridStatus: 'uncertain' };
  assert.equal(improvements({ ...data, semantic: { ...data.semantic, matches: [preferred, required] } })[0].title, required.requirement);
  assert.equal(groupRequirements({ matches: [preferred, required] })[0].matches[0].priority, 'required');
  assert.equal(summarize({ matches: [{ status: 'strong' }] }).uncertain, 1);
});
test('form supports PDF selection, disabled submission and labelled JD', () => {
  const html = render(Form, { file: null, jobDescription: '', loading: true });
  assert.match(html, /fieldset disabled/);
  assert.match(html, /accept=".pdf,application\/pdf"/);
  assert.match(html, /for="job-description"/);
  assert.match(html, /Analyzing your resume/);
});

test('four final evidence counts sum to actual rows rather than a stale total or cosine labels', () => {
  const matches = ['explicit', 'contextual', 'uncertain', 'not_evidenced'].map((evidenceKind) => ({ ...match, evidenceKind }));
  const semantic = { ...data.semantic, matches, requirementCount: 999 };
  assert.deepEqual(finalSummary(semantic), { explicit: 1, contextual: 1, uncertain: 1, not_evidenced: 1 });
  assert.equal(evidenceGroups(semantic).length, 4);
  const html = render(Dashboard, { data: { ...data, semantic } });
  assert.match(html, /data-summary-label="Requirements reviewed"><p>Requirements reviewed<\/p><strong>4<\/strong>/);
  assert.doesNotMatch(html, /999/);
});
test('satisfied OR alternatives and company-context terms never become recommended gaps', () => {
  const item = { ...match, requirement: 'Knowledge of Python OR Perl', evidenceKind: 'explicit', matchedSkills: ['python'], missingSkills: [], alternativeSkills: ['perl'], skillConditions: [{ anyOf: ['python', 'perl'], matched: ['python'], satisfied: true }] };
  const result = { ...data, missingSkills: ['perl', 'aws'], semantic: { ...data.semantic, matches: [item] } };
  assert.doesNotMatch(JSON.stringify(improvements(result)), /perl|aws/i);
  assert.deepEqual(skillGapGroups(result), { actionable: [], other: ['perl', 'aws'] });
  assert.match(render(Groups, { semantic: result.semantic }), /python or perl — mentioned: python/);
});
test('unrelated nearest excerpts are hidden and fallback recommendations avoid raw JD terms', () => {
  const html = render(Groups, { semantic: { ...data.semantic, matches: [{ ...match, evidenceKind: 'not_evidenced', evidence: { text: 'Contact private@example.com', passageIndex: 0, relevant: false } }] } });
  assert.doesNotMatch(html, /private@example.com/);
  assert.match(html, /No relevant supporting excerpt/);
  assert.doesNotMatch(JSON.stringify(improvements({ ...data, missingSkills: ['perl', 'aws'], semantic: { status: 'unavailable' } })), /perl|aws/i);
});
test('required conditions precede preferred and optional within each evidence group', () => {
  const rows = ['optional', 'preferred', 'required'].map((priority) => ({ ...match, requirement: priority + ' Python', priority, evidenceKind: 'uncertain' }));
  assert.deepEqual(evidenceGroups({ matches: rows })[0].matches.map((row) => row.priority), ['required', 'preferred', 'optional']);
  assert.equal(improvements({ ...data, semantic: { ...data.semantic, matches: rows } })[0].title, 'required Python');
  assert.equal(improvements({ ...data, semantic: { ...data.semantic, matches: rows } }).length, 2);
});
test('retry and replacement submission are explicit form actions', () => {
  assert.match(render(Form, { file: null, jobDescription: '', error: 'Failed' }), /Retry analysis/);
  assert.match(render(Form, { file: null, jobDescription: '', data: {} }), /Analyze again/);
});

test('technical section priorities drive row labels and required group counts without changing evidence counts', () => {
  const required = { ...match, requirement: 'Strong C/C++ proficiency.', priority: 'required', sourceSection: 'Required Technical Skills', evidenceKind: 'uncertain', hybridStatus: 'uncertain' };
  const preferred = { ...match, requirement: 'Knowledge of CUDA.', priority: 'preferred', sourceSection: 'Preferred Technical Skills', evidenceKind: 'uncertain', hybridStatus: 'uncertain', matchedSkills: [], missingSkills: ['cuda'] };
  const semantic = { ...data.semantic, matches: [preferred, required], requirementCount: 2 };
  const html = render(Groups, { semantic });
  assert.match(html, /<span>required<\/span>/);
  assert.match(html, /<span>preferred<\/span>/);
  assert.match(html, /1 required/);
  assert.ok(html.indexOf(required.requirement) < html.indexOf(preferred.requirement));
  assert.deepEqual(finalSummary(semantic), { explicit: 0, contextual: 0, uncertain: 2, not_evidenced: 0 });
});

test('explicit C/C++ mentions clarify unverified proficiency while retaining needs-verification status', () => {
  const row = { ...match, requirement: 'Strong C/C++ proficiency.', matchedSkills: ['c', 'c++'], evidenceKind: 'uncertain', hybridStatus: 'uncertain' };
  const html = render(Groups, { semantic: { ...data.semantic, matches: [row] } });
  assert.match(html, /Skill mentioned · proficiency unverified/);
  assert.match(html, /class="badge uncertain">Needs verification/);
  assert.match(html, /Built C\/C\+\+ drivers/);
  assert.equal(finalSummary({ matches: [row] }).explicit, 0);
  const plain = render(Groups, { semantic: data.semantic });
  assert.doesNotMatch(plain, /Skill mentioned · proficiency unverified/);
});
