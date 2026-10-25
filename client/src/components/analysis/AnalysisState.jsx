export default function AnalysisState({ loading, error, hasData }) {
  if (loading) return <section className="state-panel" role="status"><span className="spinner" aria-hidden="true" /><div><h2>Connecting your experience to the role</h2><p>Reading the PDF, checking skill mentions, and reviewing contextual evidence.</p></div></section>;
  if (error) return <section className="state-panel error-state" role="alert"><span aria-hidden="true">!</span><div><h2>We couldn’t complete this analysis</h2><p>{error}</p><p>Your inputs are preserved. Adjust them and try again.</p></div></section>;
  if (hasData) return null;
  return <section className="empty-state"><span className="empty-icon" aria-hidden="true">◎</span><div><h2>A clearer view of your next opportunity</h2><p>Add your resume and a job description to see skill coverage, evidence, and actionable next steps.</p></div><span className="subtle-tag hidden md:inline-flex">NO SCORES UNTIL YOU ANALYZE</span></section>;
}
