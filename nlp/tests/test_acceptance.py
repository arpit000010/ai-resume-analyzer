"""Final local regressions from real JD/resume failure modes."""
import unittest
from nlp.processing.requirements import extract_requirements
from nlp.processing.passages import resume_records
from nlp.processing.skills import extract_skills, skill_is_negated
from nlp.matching.hybrid import assess


def requirement(text, priority='required'):
    items, _ = extract_requirements(f'Required qualifications:\n- {text}')
    if len(items) != 1:
        raise AssertionError(items)
    return {**items[0], 'priority': priority}


class AcceptanceTests(unittest.TestCase):
    def test_markdown_title_metadata_team_names_and_intros_are_not_requirements(self):
        text = '''# Senior Systems Software Engineer
## Core Kernel Team
Location: Bangalore
Employment Type: Full-time
Job ID: 12345
## About us
We are a technology company using Python and AWS.
## Required Qualifications
- Knowledge of **C/C++** and Operating Systems.
- Python OR Perl
## Preferred Skills
- Familiarity with CUDA.
## Optional Skills
- OOP is optional.
'''
        items, _ = extract_requirements(text)
        self.assertEqual(len(items), 4, items)
        self.assertEqual([r['priority'] for r in items], ['required', 'required', 'preferred', 'optional'])
        self.assertEqual(items[0]['skills'], ['c', 'c++', 'operating systems'])
        self.assertNotIn('aws', [skill for r in items for skill in r['skills']])
        malformed, _ = extract_requirements('##   Required\t Qualifications\n-\tPython OR\t Perl\n## Preferred  Skills\n-\tLinux')
        self.assertEqual([item['priority'] for item in malformed], ['required', 'preferred'])

    def test_plain_text_setext_headers_duplicates_and_wrapped_fragments(self):
        text = '''Systems Software Engineer
=========================
Required qualifications
- Experience with Python is a
must.
- Knowledge of C++.
- Knowledge of C++
Preferred qualifications
- Knowledge of C++.
- Familiarity with Perl is not required.
'''
        items, _ = extract_requirements(text)
        self.assertEqual(len(items), 3, items)
        cpp = next(r for r in items if 'C++' in r['text'])
        self.assertEqual(cpp['priority'], 'required')
        self.assertEqual(cpp['extractionConfidence'], 'uncertain')
        self.assertEqual(items[-1]['priority'], 'optional')
        self.assertTrue(all(r['text'] != 'must.' for r in items))

    def test_valid_unknown_and_incomplete_conditions_are_retained_for_review(self):
        items, _ = extract_requirements('Required qualifications:\n- Willingness to relocate internationally.\n- Experience with')
        self.assertEqual(len(items), 2)
        self.assertTrue(all(r['extractionConfidence'] == 'uncertain' for r in items))
        self.assertEqual(assess(items[1], ['Python projects.'], [0.1])['evidenceKind'], 'uncertain')
        generic, _ = extract_requirements('## Qualifications\n- Knowledge of Python.\n## Additional skills\n- Knowledge of Linux.')
        self.assertEqual([item['priority'] for item in generic], ['unspecified', 'unspecified'])

    def test_python_or_perl_is_satisfied_by_either_without_false_missing_alternative(self):
        req = requirement('Knowledge of Python OR Perl.')
        for language in ['Python', 'Perl']:
            result = assess(req, [f'Skills: {language}'], [0.1])
            self.assertEqual(result['evidenceKind'], 'explicit')
            self.assertEqual(result['missingSkills'], [])
            self.assertEqual(result['skillConditions'][0]['anyOf'], ['python', 'perl'])
            self.assertTrue(result['skillConditions'][0]['satisfied'])
            self.assertEqual(len(result['alternativeSkills']), 1)
        absent = assess(req, ['Built C++ drivers.'], [0.1])
        self.assertEqual(absent['evidenceKind'], 'not_evidenced')
        self.assertEqual(set(absent['missingSkills']), {'python', 'perl'})

    def test_or_does_not_erase_additional_and_conditions(self):
        req = requirement('Knowledge of Python or Perl and Linux.')
        result = assess(req, ['Skills: Python'], [0.8])
        self.assertEqual(result['missingSkills'], ['linux'])
        self.assertEqual(result['alternativeSkills'], ['perl'])
        self.assertEqual(result['evidenceKind'], 'contextual')
        repeated = assess(requirement('Python OR Perl and Python.'), ['Perl projects'], [0.9])
        self.assertEqual(repeated['missingSkills'], ['python'])
        self.assertNotIn('python', repeated['alternativeSkills'])
        comma = assess(requirement('Knowledge of Python, Perl, or Linux.'), ['Python'], [0.1])
        self.assertEqual(comma['missingSkills'], [])
        self.assertEqual(comma['evidenceKind'], 'explicit')
        extra = assess(requirement('Knowledge of Python and incident ownership.'), ['Python'], [0.8])
        self.assertEqual(extra['evidenceKind'], 'uncertain')

    def test_all_explicit_systems_skills_are_detected(self):
        found = extract_skills('C, C++, Python, Operating Systems, DSA and OOP')
        self.assertEqual(set(found), {'c', 'c++', 'python', 'operating systems', 'data structures', 'algorithms', 'object-oriented programming'})
        self.assertNotIn('c', extract_skills('C++'))

    def test_education_abbreviations_match_only_the_named_degree_and_field(self):
        req = requirement('B.Tech Computer Science eligibility.')
        self.assertEqual(req['category'], 'education')
        result = assess(req, ['B.Tech CSE, completed 2023'], [0.15], ['education'])
        self.assertEqual(result['evidenceKind'], 'explicit')
        self.assertEqual(result['basis'], 'explicit_education')
        self.assertEqual(result['evidence']['section'], 'education')
        self.assertEqual(assess(req, ['Bachelor of Technology in Computer Science'], [0.15], ['education'])['evidenceKind'], 'explicit')
        for excerpt in ['B.Tech Mechanical Engineering', 'B.Sc Computer Science', 'Computer Science projects', 'Pursuing B.Tech CSE', 'No B.Tech CSE degree']:
            mismatch = assess(req, [excerpt], [0.9], ['education'])
            self.assertNotEqual(mismatch['evidenceKind'], 'explicit', excerpt)

    def test_source_sections_exclude_contacts_and_hobbies_but_keep_skill_bullets(self):
        text = 'Contact\npython@example.com\n\nSkills: C, C++, Python\n\nProjects\n- Built Linux drivers.\n\nHobbies\nPython trivia and Perl games.\n\nEducation\nB.Tech CSE'
        records = resume_records(text, 30)
        self.assertEqual([r['section'] for r in records], ['skills', 'projects', 'education'])
        self.assertNotIn('example.com', str(records))
        self.assertNotIn('trivia', str(records))
        self.assertEqual(resume_records('Contact\nname@example.com\n\nHobbies\nChess', 10), [])

    def test_unrelated_high_cosine_is_not_support_and_context_cannot_prove_qualification(self):
        req = requirement('Knowledge of CUDA.')
        result = assess(req, ['Email cuda@example.com', 'Coordinated catering.'], [0.99, 0.95], ['contact', 'experience'])
        self.assertEqual(result['matchedSkills'], [])
        self.assertEqual(result['evidenceKind'], 'uncertain')
        self.assertFalse(result['evidence']['relevant'])
        self.assertEqual(result['evidence']['passageIndex'], 1)
        self.assertIn('cuda', result['missingSkills'])

    def test_proficiency_years_and_certifications_are_not_proven_by_mentions(self):
        for text in ['Expert Python proficiency.', '5 years of Python experience.', 'AWS certification required.']:
            result = assess(requirement(text), ['Python and AWS projects'], [0.9], ['projects'])
            self.assertEqual(result['evidenceKind'], 'uncertain', text)

    def test_negation_is_conservative_without_rejecting_affirmative_but_clause(self):
        self.assertTrue(skill_is_negated('Unfamiliar with Python', 'python'))
        self.assertTrue(skill_is_negated('No Python experience', 'python'))
        self.assertFalse(skill_is_negated('No Perl experience, but I built Python services.', 'python'))
        self.assertFalse(skill_is_negated('Not only Python but also C++.', 'python'))
        self.assertEqual(assess(requirement('Knowledge of Python.'), ['Not only Python but also C++.'], [0.8])['evidenceKind'], 'explicit')
        result = assess(requirement('Knowledge of Python.'), ['Unfamiliar with Python'], [0.1])
        self.assertEqual(result['evidenceKind'], 'uncertain')
        self.assertEqual(result['matchedSkills'], [])


if __name__ == '__main__':
    unittest.main()
