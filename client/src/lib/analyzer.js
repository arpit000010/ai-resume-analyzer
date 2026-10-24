import axios from "axios";
import constraints from "../../../shared/constraints.json" with { type: "json" };

export function validateInputs(file, jobDescription) {
  if (!file) return "Upload a PDF resume.";
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) return "Only PDF resumes (.pdf) are accepted.";
  if (!file.size) return "The PDF file is empty.";
  if (file.size > constraints.maxUploadBytes) return "The resume must be 5 MiB or smaller.";
  if (jobDescription.trim().length < constraints.minJobDescriptionLength || jobDescription.length > constraints.maxJobDescriptionLength) {
    return "Provide a job description of 20–20,000 characters.";
  }
  return "";
}

export async function analyzeResume(file, jobDescription) {
  const formData = new FormData();
  formData.append("resume", file);
  formData.append("jobDescription", jobDescription.trim());
  const baseUrl = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");
  try {
    const { data } = await axios.post(`${baseUrl}/api/analyze`, formData, { timeout: 30000 });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.error?.message ||
      (error.code === "ECONNABORTED" ? "Analysis timed out. Please try a simpler PDF." : "Cannot reach the analyzer. Check that the local server is running and try again."));
  }
}
