import Header from '../components/layout/Header.jsx';
import AnalysisForm from '../components/forms/AnalysisForm.jsx';
import AnalysisState from '../components/analysis/AnalysisState.jsx';
import ResultsDashboard from '../components/analysis/ResultsDashboard.jsx';
import { useAnalysis } from '../hooks/useAnalysis.js';

export default function AnalyzerPage() {
  const analysis = useAnalysis();
  return <><a className="skip-link" href="#workspace">Skip to analyzer</a><div className="app-shell"><Header />
    <main id="workspace"><div className="hero"><div><p className="eyebrow">RESUME / JOB DESCRIPTION</p><h1>Resume analysis</h1><p>Review skill mentions, contextual evidence, and qualification gaps.</p></div><a className="workspace-link" href="#job-description">Edit job description <span aria-hidden="true">↗</span></a></div>
      <AnalysisForm {...analysis} />
      <AnalysisState loading={analysis.loading} error={analysis.error} hasData={Boolean(analysis.data)} />
      {analysis.data && <ResultsDashboard data={analysis.data} />}
    </main><footer><span>ResumeLens <span className="muted">/ AI Resume Analyzer 2.0</span></span><span>Evidence over assumptions. Always review before applying.</span></footer>
  </div></>;
}
