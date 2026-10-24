import { useState } from "react";
import { analyzeResume, validateInputs } from "./lib/analyzer";
import constraints from "../../shared/constraints.json" with { type: "json" };

function App() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile || null);
    setFileName(uploadedFile?.name || "");
    setData(null);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setData(null);
    const validationError = validateInputs(file, jobDescription);
    setError(validationError);
    if (validationError) return;
    setLoading(true);
    try {
      setData(await analyzeResume(file, jobDescription));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-6">
      <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-2xl p-8">
        <h1 className="text-4xl font-bold text-center mb-2">
          AI Resume Analyzer 2.0
        </h1>
        <p className="text-center text-slate-500 mb-8">
          Compare your PDF resume with a real job description
        </p>

        {/* Resume and job description */}
        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
          <fieldset disabled={loading} className="contents">
            {/* Custom Upload */}
            <div className="border-2 border-dashed rounded-xl p-6 text-center">
              <p className="font-semibold mb-3">Upload Resume</p>
              <p className="text-sm text-slate-500 mb-3">Text-based PDF · up to 5 MiB · processed locally</p>

              <label className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-lg inline-block">
                Choose File
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  aria-label="Choose PDF resume"
                  className="block max-w-full mt-2 text-sm"
                  onChange={handleFileChange}
                />
              </label>

              {fileName && (
                <p className="mt-3 text-sm text-slate-600">📄 {fileName}</p>
              )}
            </div>

            <div>
              <label htmlFor="job-description" className="block font-semibold mb-2">Job description</label>
              <textarea
                id="job-description"
                className="w-full border border-slate-400 rounded-xl p-3 min-h-48"
                value={jobDescription}
                minLength={constraints.minJobDescriptionLength}
                maxLength={constraints.maxJobDescriptionLength}
                required
                placeholder="Paste the responsibilities, requirements, and skills from the job posting…"
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  setData(null);
                  setError("");
                }}
                aria-describedby="jd-help"
              />
              <p id="jd-help" className="text-sm text-slate-500">20–20,000 characters. {jobDescription.length.toLocaleString()} entered.</p>
            </div>

            <div className="md:col-span-2 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-semibold"
              >
                Analyze Resume
              </button>
            </div>
          </fieldset>
        </form>
        {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}

        {/* Loading */}
        {loading && (
          <p role="status" className="text-center mt-6 font-semibold">Analyzing resume...</p>
        )}

        {/* Results */}
        {data && (
          <div className="mt-10 space-y-8">
            <div className="bg-slate-50 rounded-xl p-6 shadow">
              <h2 className="text-2xl font-bold">Skill coverage baseline</h2>
              <p className="mt-2 text-3xl font-semibold">
                {data.baselinePercentage === null ? "Not enough recognized skills to score" : `${data.baselinePercentage}%`}
              </p>
              <p className="mt-2">{data.scoring.matchedCount} matched / {data.scoring.requiredCount} recognized job skills</p>
              <p className="mt-2 text-sm text-slate-600">{data.scoring.formula}</p>
              <p className="mt-2 text-sm text-slate-600">{data.scoring.explanation}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-green-50 rounded-xl p-6 shadow">
                <h3 className="font-semibold text-green-700 mb-3">
                  ✔ Matched Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {!data.matchedSkills.length && <p>No matching skills found.</p>}
                  {data.matchedSkills.map((s, i) => (
                    <span
                      key={i}
                      className="bg-green-200 px-3 py-1 rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-red-50 rounded-xl p-6 shadow">
                <h3 className="font-semibold text-red-700 mb-3">
                  ✖ Missing Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {!data.missingSkills.length && <p>{data.jobSkills.length ? "No recognized job skills missing." : "No job skills recognized in the catalog."}</p>}
                  {data.missingSkills.map((s, i) => (
                    <span key={i} className="bg-red-200 px-3 py-1 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-6 shadow">
              <h3 className="font-semibold mb-2">💡 Resume Suggestions</h3>
              <ul className="list-disc pl-5">
                {data.suggestions.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
