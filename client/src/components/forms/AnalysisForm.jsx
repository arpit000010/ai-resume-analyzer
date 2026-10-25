import constraints from '../../../../shared/constraints.json' with { type: 'json' };

export default function AnalysisForm({ file, jobDescription, loading, changeFile, changeDescription, submit, error, data }) {
  return <form onSubmit={submit} aria-busy={loading}>
    <fieldset disabled={loading} className="min-w-0 border-0 p-0">
      <legend className="sr-only">Upload your resume and paste a job description</legend>
      <div className="form-grid">
        <section className="panel input-panel">
          <div className="panel-title"><span className="step">01</span><h2>Your resume</h2><span className="subtle-tag">PDF</span></div>
          <label className={`upload-zone ${file ? 'has-file' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); if (!loading) changeFile(event.dataTransfer.files[0] || null); }}>
            <input type="file" accept=".pdf,application/pdf" className="sr-only" aria-label="Choose PDF resume" onChange={(event) => { changeFile(event.target.files[0] || null); event.target.value = ''; }} />
            <span className="upload-icon" aria-hidden="true">{file ? '✓' : '↑'}</span>
            <strong className="break-words max-w-full">{file ? file.name : 'Drop your resume here'}</strong>
            <span>{file ? `${(file.size / 1024).toFixed(0)} KB · Click to replace` : 'or browse files on your device'}</span>
            <span className="browse-button">{file ? 'Replace PDF' : 'Choose a PDF'}</span>
          </label>
          <p className="input-note">Text-based PDF · Up to 5 MiB<br />Processed in memory. No document storage.</p>
        </section>
        <section className="panel input-panel">
          <div className="panel-title"><span className="step">02</span><label htmlFor="job-description">The opportunity</label><span className="subtle-tag">JOB DESCRIPTION</span></div>
          <textarea id="job-description" value={jobDescription} onChange={(event) => changeDescription(event.target.value)}
            placeholder="Paste the job description here. Include qualifications, required skills, and preferred experience…"
            required minLength={constraints.minJobDescriptionLength} maxLength={constraints.maxJobDescriptionLength} aria-describedby="jd-help" />
          <p id="jd-help" className="input-note flex justify-between gap-3"><span>20–20,000 characters. Clear requirements give better results.</span><span className="tabular-nums shrink-0">{jobDescription.length.toLocaleString()} / 20,000</span></p>
        </section>
      </div>
      <div className="analyze-bar"><p>Find the evidence. Understand the gaps.<br /><span>Keyword coverage + local semantic analysis.</span></p>
        <button type="submit" className="primary-button" disabled={loading}>{loading ? <><span className="spinner" aria-hidden="true" /> Analyzing your resume…</> : <>{error ? 'Retry analysis' : data ? 'Analyze again' : 'Analyze match'} <span aria-hidden="true">↗</span></>}</button>
      </div>
    </fieldset>
  </form>;
}
