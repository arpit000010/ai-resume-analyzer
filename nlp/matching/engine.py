from nlp.config import MODEL_ID, THRESHOLDS, EXPLANATION, MAX_RESUME_PASSAGES, MAX_JD_PASSAGES
from nlp.processing.passages import resume_records
from nlp.matching.similarity import cosine_matrix
from nlp.processing.requirements import extract_requirements
from nlp.matching.hybrid import assess, evidence_index

class SemanticEngine:
    def __init__(self, model, revision=None):
        self.model = model
        self.revision = revision

    def match(self, resume_text, job_description):
        tokenizer = self.model.tokenizer
        budget = self.model.max_seq_length - tokenizer.num_special_tokens_to_add(pair=False)
        records = resume_records(resume_text, MAX_RESUME_PASSAGES, tokenizer, budget)
        resume = [item["text"] for item in records]
        sections = [item["section"] for item in records]
        requirements, excluded = extract_requirements(job_description, tokenizer, budget, MAX_JD_PASSAGES)
        if not resume:
            raise ValueError("The resume needs readable passages.")
        if not requirements:
            return {"status": "available", "method": "passage-cosine-v1", "analysisVersion": "hybrid-requirements-v2",
                    "model": MODEL_ID, "revision": self.revision, "thresholds": THRESHOLDS.copy(),
                    "explanation": EXPLANATION, "resumePassageCount": len(resume), "requirementCount": 0,
                    "excludedPassageCount": excluded, "matches": [],
                    "warnings": ["No actionable requirements were recognized. Paste the qualifications and responsibilities; review the original JD manually."]}
        # One batched encode call per request, reusing the process's loaded model.
        vectors = self.model.encode([item["text"] for item in requirements] + resume, batch_size=16, normalize_embeddings=True,
                                    convert_to_numpy=True, show_progress_bar=False)
        if len(vectors) != len(requirements) + len(resume):
            raise ValueError("Invalid embedding count")
        # Matrix multiplication keeps retrieval CPU-friendly at the passage caps.
        scores = cosine_matrix(vectors, len(requirements))
        evidence = evidence_index(resume, sections)
        matches = [assess(requirement, resume, scores[index], sections, evidence) for index, requirement in enumerate(requirements)]
        return {
            "status": "available", "method": "passage-cosine-v1", "analysisVersion": "hybrid-requirements-v2", "model": MODEL_ID,
            "revision": self.revision, "thresholds": THRESHOLDS.copy(),
            "explanation": EXPLANATION,
            "resumePassageCount": len(resume), "requirementCount": len(requirements),
            "matches": matches, "excludedPassageCount": excluded, "warnings": [],
        }
