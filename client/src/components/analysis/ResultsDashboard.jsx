import { finalSummary, improvements } from '../../utils/results.js';
import RequirementGroups from './RequirementGroups.jsx';
import SkillCoverage from './SkillCoverage.jsx';

export default function ResultsDashboard({ data }) {
  const counts = finalSummary(data.semantic);
  const available = data.semantic?.status === 'available';
  return <div id="analysis" className="results-dashboard">
    <div className="results-heading"><div><p className="eyebrow">YOUR ANALYSIS</p><h2>Your analysis, at a glance.</h2></div><span className="badge neutral">{available ? 'Hybrid evidence analysis' : 'Keyword-only analysis'}</span></div>
    <section className="overview-grid" aria-label="Analysis overview">
      {[[available ? data.semantic.matches.length : '—', 'Requirements reviewed', 'Final extracted requirements', 'neutral'], [available ? counts.explicit : '—', 'Direct mentions', 'Self-reported; not verified proficiency', 'supported'], [available ? counts.contextual : '—', 'Partial / contextual', 'Related evidence; conditions unconfirmed', 'uncertain'], [available ? counts.uncertain : '—', 'Needs verification', 'Ambiguous, negated, or unverified conditions', 'uncertain'], [available ? counts.not_evidenced : '—', 'Not evidenced', 'No sufficiently relevant evidence found', 'missing']].map(([number, label, note, status]) => <div className={`overview-card ${status}`} data-summary-label={label} key={label}><p>{label}</p><strong>{number}</strong><span>{note}</span></div>)}
    </section>
    <div className="results-grid"><div className="min-w-0 space-y-6">
      <section className="panel" aria-labelledby="improvements-heading"><div className="section-heading"><div><p className="eyebrow">START HERE</p><h2 id="improvements-heading">Your next improvements</h2></div><span className="subtle-tag">PRIORITIZED</span></div><ol className="improvements">{improvements(data).map((tip, index) => <li key={index}><span className="tip-index">{String(index + 1).padStart(2, '0')}</span><div><p className="tip-priority">{tip.priority}</p><h3>{tip.title}</h3><p>{tip.text}</p></div></li>)}</ol></section>
      <RequirementGroups semantic={data.semantic} />
    </div><SkillCoverage data={data} /></div>
  </div>;
}
