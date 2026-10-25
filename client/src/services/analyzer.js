import axios from "axios";
import { API_BASE_URL } from "../config/index.js";

export async function analyzeResume(file, jobDescription) {
  const formData = new FormData();
  formData.append("resume", file);
  formData.append("jobDescription", jobDescription.trim());
  const baseUrl = API_BASE_URL;
  try {
    const { data } = await axios.post(`${baseUrl}/api/analyze`, formData, { timeout: 30000 });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.error?.message ||
      (error.code === "ECONNABORTED" ? "Analysis timed out. Please try a simpler PDF." : "Cannot reach the analyzer. Check that the local server is running and try again."));
  }
}
