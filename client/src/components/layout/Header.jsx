export default function Header() {
  return <header className="app-header">
    <a href="#workspace" className="brand" aria-label="Resume Lens home">
      <span className="brand-mark" aria-hidden="true">R<span>↗</span></span>
      <span>Resume<span className="brand-accent">Lens</span><small>AI RESUME ANALYZER 2.0</small></span>
    </a>
    <span className="local-label"><span aria-hidden="true" className="status-dot" /> Local processing<span className="hidden sm:inline"> · CPU inference</span></span>
  </header>;
}
