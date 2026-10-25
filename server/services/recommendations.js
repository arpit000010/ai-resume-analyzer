// Keep the public string-array suggestions field grounded in final requirements.
const rank = { required: 0, responsibility: 1, unspecified: 2, preferred: 3, optional: 4 };
module.exports = (semantic) => {
  if (semantic?.status !== 'available') return ['Keyword coverage is literal full-JD overlap. Restore contextual analysis or review the qualification sections manually before treating an unmentioned term as a requirement gap.'];
  if (!semantic.matches.length) return ['No actionable requirements were recognized. Paste qualifications and responsibilities rather than only a role title, metadata, or company introduction.'];
  const gaps = semantic.matches.filter((item) => item.priority !== 'optional' && (item.evidenceKind ? item.evidenceKind !== 'explicit' : item.hybridStatus !== 'supported'))
    .sort((a, b) => rank[a.priority || 'unspecified'] - rank[b.priority || 'unspecified']);
  if (!gaps.length) return ['Strengthen self-reported mentions with concrete contributions and measurable outcomes. Direct mentions do not establish proficiency, verified credentials, or eligibility.'];
  return gaps.slice(0, 3).map((item) => {
    const guidance = item.extractionConfidence === 'uncertain' ? 'Check incomplete or ambiguous wording against the original JD.'
      : item.category === 'education' ? 'Clarify degree, field, and completion status; eligibility may need employer confirmation.'
        : item.category === 'experience' ? 'Clarify relevant dates, scope, and contribution; related text does not establish the requested years.'
          : 'If you meet this condition, add a specific supporting example. Do not claim skills or experience you have not used.';
    return `${item.priority === 'required' ? 'Required' : item.priority === 'preferred' ? 'Preferred' : 'Review'}: ${item.requirement} ${guidance}`;
  });
};
