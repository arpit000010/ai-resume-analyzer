import unittest
from nlp.processing.requirements import extract_requirements
from nlp.processing.passages import resume_passages
from nlp.processing.skills import extract_skills
from nlp.matching.hybrid import assess


class QualityTests(unittest.TestCase):
    def test_headers_company_text_fragments_and_required_preferred(self):
        jd = '''About NVIDIA
NVIDIA is a technology company building products for the world.
What we need to see:
- Experience programming in C/C++ is a
must.
- 5+ years of professional experience developing systems software.
- Bachelor's degree in Computer Science or equivalent experience.
Ways to stand out from the crowd:
- Familiarity with CUDA is a plus.
Benefits:
We offer generous leave and compensation.
must.
'''
        items, excluded = extract_requirements(jd)
        self.assertEqual(len(items), 4, items)
        self.assertEqual([item['category'] for item in items], ['technical', 'experience', 'education', 'technical'])
        self.assertEqual([item['priority'] for item in items], ['required', 'required', 'required', 'preferred'])
        self.assertTrue(all(item['text'].lower() != 'must.' for item in items))
        self.assertGreater(excluded, 2)

    def test_filler_only_produces_no_fake_requirements(self):
        items, _ = extract_requirements('About us:\nWe are a global company.\n\nBenefits:\nWe offer flexible working.\n\nRequirements:\nmust.')
        self.assertEqual(items, [])

    def test_concise_skills_and_inline_qualification_headers(self):
        items, _ = extract_requirements('Required qualifications: Knowledge of Linux.\n- C/C++\nPreferred skills:\n- Python')
        self.assertEqual(len(items), 3, items)
        self.assertEqual(items[1]['skills'], ['c', 'c++'])
        self.assertEqual(items[-1]['priority'], 'preferred')

    def test_resume_sections_bullets_do_not_merge_unrelated_evidence(self):
        parts = resume_passages('SKILLS\nC/C++ and Linux\n\nEXPERIENCE\n• Developed device drivers.\n• Coordinated catering.\n\nEDUCATION\nBachelor of Science', 20)
        self.assertNotIn('SKILLS', parts)
        self.assertIn('C/C++ and Linux', parts)
        self.assertIn('Developed device drivers.', parts)
        self.assertTrue(all(not ('drivers' in text and 'catering' in text) for text in parts))

    def test_explicit_c_cpp_is_supported_despite_weak_similarity(self):
        requirement = {'text': 'Programming with C/C++', 'skills': ['c', 'c++'], 'category': 'technical', 'priority': 'required'}
        result = assess(requirement, ['Skills: C/C++, Linux', 'Led an unrelated event.'], [0.1, 0.9])
        self.assertEqual(result['status'], 'weak')
        self.assertEqual(result['hybridStatus'], 'supported')
        self.assertEqual(result['evidence']['passageIndex'], 0)
        self.assertEqual(result['matchedSkills'], ['c', 'c++'])
        self.assertIn('not proficiency', result['uncertainty'][0])

    def test_alias_boundaries_and_language_versions(self):
        self.assertEqual(extract_skills('C++17 C# JavaScript GitHub Next.js'), ['c++', 'c#', 'javascript', 'github', 'next.js'])
        self.assertEqual(extract_skills('C/C++ CPP'), ['c', 'c++'])

    def test_high_similarity_does_not_invent_explicit_skill(self):
        req = {'text': 'Knowledge of CUDA', 'skills': ['cuda'], 'category': 'technical', 'priority': 'required'}
        result = assess(req, ['Optimized parallel software.'], [0.95])
        self.assertEqual(result['hybridStatus'], 'uncertain')
        self.assertEqual(result['missingSkills'], ['cuda'])
        self.assertEqual(result['matchedSkills'], [])

    def test_negation_and_aspiration_are_uncertain(self):
        req = {'text': 'Programming with C++', 'skills': ['c++'], 'category': 'technical', 'priority': 'required'}
        result = assess(req, ['No experience with C++'], [0.95])
        self.assertEqual(result['hybridStatus'], 'uncertain')
        self.assertEqual(result['matchedSkills'], [])
        self.assertEqual(assess(req, ['Learning C++ through tutorials.'], [0.8])['hybridStatus'], 'uncertain')

    def test_years_education_proficiency_require_manual_review(self):
        for text, category in [('5 years of C++ experience', 'experience'), ('Bachelor degree in computer science', 'education'), ('Expert C++ proficiency', 'technical')]:
            req = {'text': text, 'skills': ['c++'] if category != 'education' else [], 'category': category, 'priority': 'required'}
            self.assertEqual(assess(req, ['C++ projects; bachelor degree.'], [0.9])['hybridStatus'], 'uncertain')

    def test_no_relevant_evidence_is_missing_not_proof_of_inability(self):
        req = {'text': 'Knowledge of CUDA', 'skills': ['cuda'], 'category': 'technical', 'priority': 'preferred'}
        result = assess(req, ['Coordinated catering.'], [0.05])
        self.assertEqual(result['hybridStatus'], 'missing')
        self.assertIn('not proof of inability', result['uncertainty'][-1])


if __name__ == '__main__':
    unittest.main()
