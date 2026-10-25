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

