export const CATEGORIES = { technical: 'Technical skills', experience: 'Experience', education: 'Education', other: 'Other requirements' };
export const KIND_LABELS = { explicit: 'Direct mentions', contextual: 'Partial / contextual', uncertain: 'Needs verification', not_evidenced: 'Not evidenced' };
export const STATUS_LABELS = { supported: 'Direct mentions', uncertain: 'Needs review', missing: 'Not evidenced' };
const PRIORITY = { required: 0, responsibility: 1, unspecified: 2, preferred: 3, optional: 4 };
export function finalKind(match) {
  return match.evidenceKind || (match.hybridStatus === 'supported' ? 'explicit' : match.hybridStatus === 'missing' || match.status === 'weak' && !match.hybridStatus ? 'not_evidenced' : 'uncertain');
}
export function evidenceStatus(match) {
  return { explicit: 'supported', contextual: 'uncertain', uncertain: 'uncertain', not_evidenced: 'missing' }[finalKind(match)];
}
export function finalSummary(semantic) {
  const counts = { explicit: 0, contextual: 0, uncertain: 0, not_evidenced: 0 };
  if (semantic?.status && semantic.status !== 'available') return counts;
  for (const match of semantic?.matches || []) counts[finalKind(match)] += 1;
  return counts;
}
export function summarize(semantic) {
  const count = finalSummary(semantic);
  return { supported: count.explicit, uncertain: count.contextual + count.uncertain, missing: count.not_evidenced };
}
export function groupRequirements(semantic) {
  return Object.keys(CATEGORIES).map((key) => ({
    key, label: CATEGORIES[key], matches: (semantic?.matches || []).filter((match) => (match.category || 'other') === key)
      .sort((a, b) => PRIORITY[a.priority || 'unspecified'] - PRIORITY[b.priority || 'unspecified']),
  })).filter((group) => group.matches.length);
}
export function evidenceGroups(semantic) {
  return Object.entries(KIND_LABELS).map(([key, label]) => ({ key, label,
    matches: (semantic?.matches || []).filter((match) => finalKind(match) === key)
      .sort((a, b) => PRIORITY[a.priority || 'unspecified'] - PRIORITY[b.priority || 'unspecified']),
  })).filter((group) => group.matches.length);
}
export function improvements(data) {
  const semantic = data.semantic;
  if (semantic?.status !== 'available') return [{ priority: 'Analysis availability', title: 'Restore contextual analysis, then review qualifications', text: 'Keyword coverage is literal full-JD overlap. Review required and preferred qualifications manually before treating any unmentioned term as a gap.' }];
  if (!semantic.matches?.length) return [{ priority: 'Job description', title: 'Add usable qualifications and responsibilities', text: 'No actionable requirements were recognized. Paste the qualification bullets rather than only the role title or company introduction.' }];
  const gaps = semantic.matches.filter((match) => finalKind(match) !== 'explicit' && match.priority !== 'optional')
    .sort((a, b) => PRIORITY[a.priority || 'unspecified'] - PRIORITY[b.priority || 'unspecified']);
  const tips = gaps.slice(0, 3).map((match) => ({
    priority: match.priority === 'required' ? 'Required · review first' : match.priority === 'preferred' ? 'Preferred · lower priority' : 'Review',
    title: match.requirement,
    text: match.extractionConfidence === 'uncertain' ? 'Check this item against the original JD; its wording or priority is incomplete or ambiguous.'
      : finalKind(match) === 'not_evidenced' ? 'If you meet this condition, add a specific project, achievement, or qualification. Otherwise, treat it as a development gap; do not fabricate experience.'
        : match.category === 'education' ? 'Clarify the degree, field, and completion status. Eligibility or equivalence may require confirmation from the employer.'
          : match.category === 'experience' ? 'Clarify relevant dates, scope, and your contribution. Related work does not by itself establish the requested duration.'
            : 'Clarify the supporting evidence and your contribution. Direct mentions alone do not establish proficiency or satisfy every condition.',
  }));
  if (!tips.length) tips.push({ priority: 'Next step', title: 'Strengthen the evidence behind your mentions', text: 'Use specific contributions and measurable outcomes. All matches remain self-reported; this is not verified proficiency or a hiring prediction.' });
  return tips;
}
export function skillGapGroups(data) {
  if (data.semantic?.status !== 'available') return { actionable: [], other: data.missingSkills || [] };
  const actionable = new Set((data.semantic.matches || []).filter((item) => item.priority !== 'optional').flatMap((item) => item.missingSkills || []));
  return { actionable: [...actionable], other: (data.missingSkills || []).filter((skill) => !actionable.has(skill)) };
}
