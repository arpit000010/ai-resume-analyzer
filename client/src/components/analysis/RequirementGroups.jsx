import { CATEGORIES, KIND_LABELS, finalKind, evidenceStatus, evidenceGroups } from '../../utils/results.js';

export function RequirementRow({ match }) {
  const kind = finalKind(match);
  const status = evidenceStatus(match);
  const proficiencyUnverified = kind === 'uncertain' && match.matchedSkills?.length > 0 && /\b(?:expert|advanced|proficien\w*|deep|extensive|strong|hands[- ]on)\b/i.test(match.requirement);
  return <li className="requirement-row" data-evidence-kind={kind} data-category={match.category || 'other'}>
    <div className="requirement-heading"><p>{match.requirement}</p><span className={`badge ${status}`}>{KIND_LABELS[kind]}</span></div>
    <div className="requirement-meta"><span>{match.priority || 'unspecified'}</span><span>{CATEGORIES[match.category || 'other']}</span>{match.basis?.startsWith('explicit') && <span>{proficiencyUnverified ? 'Skill mentioned · proficiency unverified' : 'Explicit / alias evidence'}</span>}</div>
    <details className="evidence-details"><summary>Review evidence &amp; uncertainty</summary>
      {match.sourceSection && <p className="detail-label">JD section: {match.sourceSection}</p>}
      {match.evidence.relevant === false ? <p className="notice">No relevant supporting excerpt was found. An unrelated nearest passage is not presented as evidence.</p> : <>
        <p className="detail-label">{kind === 'not_evidenced' ? 'Nearest passage — insufficient support' : 'Resume excerpt'}{match.evidence.section && match.evidence.section !== 'unspecified' ? ` · ${match.evidence.section}` : ''}</p>
        <blockquote>{match.evidence.text}</blockquote>
      </>}
      {match.skillEvidence?.length > 0 && <div><p className="detail-label">Explicit skill mentions · not verified proficiency</p><ul>{match.skillEvidence.map((item) => <li key={item.skill} className="skill-evidence"><strong>{item.skill}</strong><span>{item.text}{item.section && item.section !== 'unspecified' ? ` (${item.section})` : ''}</span></li>)}</ul></div>}
      {match.skillConditions?.some((item) => item.anyOf.length > 1) && <p className="condition-note">Alternatives: {match.skillConditions.filter((item) => item.anyOf.length > 1).map((item) => `${item.anyOf.join(' or ')} — ${item.satisfied ? `mentioned: ${item.matched.join(', ')}` : 'not evidenced'}`).join('; ')}.</p>}
      {(match.uncertainty?.length ? match.uncertainty : ['Similarity is contextual evidence, not proof of proficiency.']).map((note) => <p className="uncertainty-note" key={note}>{note}</p>)}
      <details className="technical-details"><summary>Similarity details</summary><p>Cosine similarity: <span className="tabular-nums">{match.similarity.toFixed(4)}</span> · Retrieval signal: {match.status}. Similarity alone cannot prove a requirement; it is not a percentage or probability.</p></details>
    </details>
  </li>;
}

export default function RequirementGroups({ semantic }) {
  if (semantic?.status !== 'available') return <section className="panel fallback-panel" role="status"><span className="badge uncertain">Keyword analysis available</span><h2>Contextual evidence is unavailable</h2><p>{semantic?.message || 'Start the local NLP service to add contextual evidence. Keyword skill coverage remains available.'}</p></section>;
  return <section className="panel" aria-labelledby="requirements-heading">
    <div className="section-heading"><div><p className="eyebrow">REQUIREMENT REVIEW</p><h2 id="requirements-heading">Evidence by status</h2></div><span className="subtle-tag">{semantic.matches.length} {semantic.matches.length === 1 ? 'requirement' : 'requirements'}</span></div>
    <p className="section-note">Direct mentions are self-reported text, not verified proficiency or eligibility. Required conditions appear before preferred and optional ones within each group.</p>
    {semantic.matches.length === 0 && <p className="notice">No actionable requirements were recognized. Paste the qualifications and responsibilities, then review the original JD manually.</p>}
    <div className="requirement-groups">{evidenceGroups(semantic).map((group) => <details className="requirement-group" key={group.key}>
      <summary><span>{group.label}</span><span className="group-summary"><span>{group.matches.length} {group.matches.length === 1 ? 'item' : 'items'}</span><span className="group-count">{group.matches.filter((match) => match.priority === 'required').length} required</span></span></summary>
      <ul>{group.matches.map((match, index) => <RequirementRow key={index} match={match} />)}</ul>
    </details>)}</div>
    <details className="method-details"><summary>How this analysis works</summary><p>{semantic.explanation}</p><p>Model: {semantic.model}. {semantic.excludedPassageCount ?? 0} headings, duplicate items, or non-requirement passages filtered. Extraction is heuristic; compare against the original JD. Unspecified priority is not inferred to be mandatory.</p>{semantic.warnings?.map((warning) => <p key={warning}>{warning}</p>)}</details>
  </section>;
}
