"""Opt-in cached-model smoke check; ordinary tests never download weights."""
import os
import unittest

from fastapi.testclient import TestClient
from nlp.app import create_app
from nlp.model import load_engine


@unittest.skipUnless(os.getenv("NLP_RUN_MODEL_TESTS") == "true", "opt-in: requires cached model")
class RealModelTests(unittest.TestCase):
    def test_cpu_model_retrieves_paraphrased_resume_evidence(self):
        with TestClient(create_app(lambda: load_engine(allow_download=False))) as client:
            self.assertEqual(client.get("/health/ready").status_code, 200)
            response = client.post("/match", json={
                "resumeText": "Designed and maintained REST APIs using Python and Flask. Coordinated catering and decorated banquet halls.",
                "jobDescription": "Develop backend web services in Python.",
            })
            self.assertEqual(response.status_code, 200)
            match = response.json()["matches"][0]
            self.assertIn("REST APIs", match["evidence"]["text"])
            self.assertGreater(match["similarity"], 0.4)
            self.assertLessEqual(match["similarity"], 1)

    def test_markdown_alternatives_and_degree_equivalence_with_real_model(self):
        with TestClient(create_app(lambda: load_engine(allow_download=False))) as client:
            response = client.post('/match', json={
                'resumeText': 'Contact\npython@example.com\n\nTechnical Skills\nC, C++, Python, Operating Systems, DSA, OOP\n\nProjects\nBuilt C++ systems and Python services.\n\nEducation\nB.Tech CSE, completed 2023\n\nHobbies\nCUDA trivia',
                'jobDescription': '# Systems Software Engineer\nTeam: Kernel Platform\nLocation: Bangalore\n## Required Qualifications\n- Knowledge of C/C++, Operating Systems, DSA and OOP.\n- Knowledge of Python OR Perl.\n- B.Tech Computer Science eligibility.\n## Preferred Skills\n- CUDA experience.',
            })
            self.assertEqual(response.status_code, 200)
            result = response.json()
            self.assertEqual(result['requirementCount'], 4)
            alternative = next(item for item in result['matches'] if 'OR Perl' in item['requirement'])
            self.assertEqual(alternative['missingSkills'], [])
            self.assertEqual(alternative['evidenceKind'], 'explicit')
            degree = next(item for item in result['matches'] if item['category'] == 'education')
            self.assertEqual(degree['basis'], 'explicit_education')
            self.assertEqual(degree['evidence']['section'], 'education')
            cuda = next(item for item in result['matches'] if 'CUDA' in item['requirement'])
            self.assertEqual(cuda['matchedSkills'], [])
            self.assertEqual(cuda['missingSkills'], ['cuda'])
            self.assertNotEqual(cuda['evidence']['section'], 'interests')


if __name__ == "__main__":
    unittest.main()
