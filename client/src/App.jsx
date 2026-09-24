import { useState } from "react";
import axios from "axios";

const roles = [
  "software engineer",
  "frontend developer",
  "backend developer",
  "full stack developer"
];

function App() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setFileName(uploadedFile.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !selectedRole)
      return alert("Upload resume and select a role");

    const formData = new FormData();
    formData.append("resume", file);
    formData.append("selectedRole", selectedRole);

    setLoading(true);
    const res = await axios.post(
      "https://ai-resume-analyzer-5xpb.onrender.com/api/analyze",
      formData
    );
    setData(res.data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-6">
      <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-2xl p-8">

        <h1 className="text-4xl font-bold text-center mb-2">
          AI Resume Analyzer
        </h1>
        <p className="text-center text-slate-500 mb-8">
          Role-based ATS Resume Matching
        </p>

        {/* Upload & Role Selection */}
        <form
          onSubmit={handleSubmit}
          className="grid md:grid-cols-2 gap-6"
        >
          {/* Custom Upload */}
          <div className="border-2 border-dashed rounded-xl p-6 text-center">
            <p className="font-semibold mb-3">Upload Resume</p>

            <label className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-lg inline-block">
              Choose File
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={handleFileChange}
              />
            </label>

            {fileName && (
              <p className="mt-3 text-sm text-slate-600">
                📄 {fileName}
              </p>
            )}
          </div>

          {/* Role Dropdown */}
          <div>
            <p className="font-semibold mb-2">Select Job Role</p>
            <select
              className="w-full border rounded-xl p-3"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="">Select role</option>
              {roles.map((role, i) => (
                <option key={i} value={role}>
                  {role.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex justify-center">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-semibold"
            >
              Analyze Resume
            </button>
          </div>
        </form>

        {/* Loading */}
        {loading && (
          <p className="text-center mt-6 font-semibold">
            Analyzing resume...
          </p>
        )}

        {/* Results */}
        {data && (
          <div className="mt-10 space-y-8">

            <div className="bg-slate-50 rounded-xl p-6 shadow">
              <p className="text-sm text-slate-500">Selected Role</p>
              <h2 className="text-2xl font-bold capitalize">
                {data.selectedRole}
              </h2>
              <p className="mt-2 font-semibold">
                JD Match Score: {data.jdMatchScore}%
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-green-50 rounded-xl p-6 shadow">
                <h3 className="font-semibold text-green-700 mb-3">
                  ✔ Matched Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {data.matchedSkills.map((s, i) => (
                    <span key={i} className="bg-green-200 px-3 py-1 rounded-full">
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
                  {data.missingJDSkills.map((s, i) => (
                    <span key={i} className="bg-red-200 px-3 py-1 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-6 shadow">
              <h3 className="font-semibold mb-2">
                💡 Resume Suggestions
              </h3>
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
