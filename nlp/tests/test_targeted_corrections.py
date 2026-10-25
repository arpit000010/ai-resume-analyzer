"""Targeted section-priority and academic-field contamination regressions."""
import unittest

from nlp.processing.requirements import extract_requirements
from nlp.processing.skills import extract_skills
from nlp.matching.hybrid import assess, evidence_index


class TargetedCorrectionTests(unittest.TestCase):
    def test_required_preferred_technical_skills_inherit_only_explicit_priority(self):
        for heading_prefix in ('## ', ''):
            jd = (f'{heading_prefix}Required Technical Skills:\n- Strong C/C++ proficiency.\n'
                  f'{heading_prefix}Preferred Technical Skills:\n- Knowledge of CUDA.\n'
                  f'{heading_prefix}Technical Skills:\n- Knowledge of Python.\n')
            items, _ = extract_requirements(jd)
            self.assertEqual(len(items), 3)
            self.assertEqual([r['priority'] for r in items], ['required', 'preferred', 'unspecified'])
            self.assertEqual([r['sourceSection'] for r in items], ['Required Technical Skills', 'Preferred Technical Skills', 'Technical Skills'])
            results = [assess(r, ['C/C++ and Python'], [0.1], ['skills']) for r in items]
            self.assertEqual([r['priority'] for r in results], ['required', 'preferred', 'unspecified'])
            self.assertEqual(results[0]['evidenceKind'], 'uncertain')
            self.assertEqual(results[0]['matchedSkills'], ['c', 'c++'])
            self.assertEqual(results[0]['missingSkills'], [])

    def test_degree_field_does_not_generate_communication_skill_conditions(self):
        jd = ('## Education\n- B.Tech in Electronics and Communication Engineering.\n'
              '## Required Technical Skills\n- Knowledge of Python OR Perl.\n'
              '## Other Requirements\n- Strong communication skills.\n')
        items, _ = extract_requirements(jd)
        passages = ['B.Tech CSE', 'Skills: Python']
        sections = ['education', 'skills']
        shared_index = evidence_index(passages, sections)
        results = [assess(r, passages, [0.2, 0.1], sections, shared_index) for r in items]
        degree, alternative, communication = results
        self.assertEqual(degree['category'], 'education')
        self.assertEqual(degree['missingSkills'], [])
        self.assertEqual(degree['skillConditions'], [])
        self.assertFalse(any('communication' in note.lower() for note in degree['uncertainty']))
        self.assertEqual(alternative['missingSkills'], [])
        self.assertEqual(alternative['alternativeSkills'], ['perl'])
        self.assertEqual(communication['missingSkills'], ['communication'])
        self.assertTrue(any('communication' in note.lower() for note in communication['uncertainty']))
        # Assessment order/shared resume indexing must not affect explanations.
        reverse = [assess(r, passages, [0.2, 0.1], sections, shared_index) for r in reversed(items)]
        self.assertEqual(results, list(reversed(reverse)))

    def test_academic_resume_field_cannot_satisfy_a_separate_soft_skill(self):
        req = extract_requirements('Required skills:\n- Strong communication skills.')[0][0]
        result = assess(req, ['B.Tech Electronics and Communication Engineering'], [0.9], ['education'])
        self.assertEqual(result['matchedSkills'], [])
        self.assertEqual(result['skillEvidence'], [])
        self.assertEqual(result['missingSkills'], ['communication'])
        # Keep genuine mixed conditions, including their negation, intact.
        mixed = 'B.Tech Electronics & Communication Engineering and strong communication skills.'
        self.assertEqual(extract_skills(mixed), ['communication'])
        req = extract_requirements('Required qualifications:\n- ' + mixed)[0][0]
        self.assertEqual(req['skills'], ['communication'])
        negated = assess(req, ['B.Tech Electronics and Communication Engineering; no communication skills.'], [0.9], ['education'])
        self.assertEqual(negated['matchedSkills'], [])
        self.assertEqual(negated['skillConditions'][0]['anyOf'], ['communication'])
        self.assertEqual(len(negated['skillConditions']), 1)


if __name__ == '__main__':
    unittest.main()
