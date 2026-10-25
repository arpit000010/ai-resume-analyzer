import { skillGapGroups } from '../../utils/results.js';
export default function SkillCoverage({ data }) {
  const gaps = skillGapGroups(data);
  const score = data.baselinePercentage;
  return <section className="panel coverage-panel" aria-labelledby="coverage-heading">
    <p className="eyebrow">KEYWORD BASELINE</p><h2 id="coverage-heading">Skill coverage</h2>
    <div className="coverage-number">{score === null ? '—' : <>{score}<span>%</span></>}</div>
    <p className="muted">{score === null ? 'No catalog skills recognized in the JD' : `${data.scoring.matchedCount} of ${data.scoring.requiredCount} recognized JD skills mentioned`}</p>
    {score !== null && <div className="coverage-track" role="progressbar" aria-label="Keyword skill coverage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}><div style={{ width: `${score}%` }} /></div>}
    <p className="coverage-caption">Full-JD word overlap, separate from evidence status. Alternative and company-context terms may be unmentioned without being qualification gaps.</p>
    {[['Mentioned in both', data.matchedSkills, 'supported'], ['Requirement terms not evidenced', gaps.actionable, 'missing'], ['Other unmentioned JD terms', gaps.other, 'neutral']].map(([label, skills, color]) => <div className="skill-list" key={label}><h3><span className={`legend-dot ${color}`} />{label}<span>{skills.length}</span></h3><div className="chips">{skills.map((skill) => <span className={`skill-chip ${color}`} key={skill}>{skill}</span>)}{skills.length === 0 && <p className="muted text-sm">{data.jobSkills.length ? 'None in this group.' : 'No recognized job skills.'}</p>}</div></div>)}
    <details className="method-details"><summary>See the calculation</summary><p>{data.scoring.formula}</p><p>{data.scoring.explanation}</p></details>
  </section>;
}
