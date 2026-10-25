"""Evidence decisions with explicit alternatives, source relevance and uncertainty."""
import re
from nlp.config import THRESHOLDS
from nlp.processing.skills import extract_skills, skill_is_negated
from nlp.processing.conditions import skill_groups
from nlp.processing.education import education_mentions, equivalent_education
from nlp.matching.similarity import match_status

STOP = set('a an and or the with in on of to for by as is are be have has this that from at your you our using knowledge experience ability skills strong required develop build maintain'.split())


def content_words(text):
    return {word[:-1] if len(word) > 4 and word.endswith('s') else word
            for word in re.findall(r'[a-z]{3,}', text.casefold()) if word not in STOP}


def evidence_index(passages, sections):
    positive, negative = [], []
    for text, section in zip(passages, sections):
        skills = extract_skills(text) if section not in ('contact', 'interests') else []
        negated = {skill for skill in skills if skill_is_negated(text, skill)}
        positive.append(set(skills) - negated)
        negative.append(negated)
    return {'positive': positive, 'negative': negative, 'words': [content_words(text) for text in passages]}


def assess(requirement, passages, similarities, sections=None, index=None):
    named = requirement['skills']
    sections = sections or ['unspecified'] * len(passages)
    eligible = [section not in ('contact', 'interests') for section in sections]
    index = index or evidence_index(passages, sections)
    positive = index['positive']
    skill_evidence = []
    for skill in named:
        candidates = [i for i, skills in enumerate(positive) if skill in skills]
        if candidates:
            best = max(candidates, key=lambda i: (sections[i] in ('experience', 'projects'), float(similarities[i])))
            skill_evidence.append({'skill': skill, 'text': passages[best], 'passageIndex': best, 'section': sections[best]})
    matched = [item['skill'] for item in skill_evidence]
    groups = skill_groups(requirement['text'], named)
    conditions = [{'anyOf': group, 'matched': [skill for skill in group if skill in matched],
                   'satisfied': any(skill in matched for skill in group)} for group in groups]
    missing = list(dict.fromkeys(skill for condition in conditions if not condition['satisfied'] for skill in condition['anyOf']))
    alternatives = [skill for condition in conditions if condition['satisfied'] for skill in condition['anyOf'] if skill not in matched and skill not in missing]
    req_words = content_words(requirement['text'])
    education = requirement['category'] == 'education'
    equivalent = [i for i, passage in enumerate(passages) if eligible[i] and education and equivalent_education(requirement['text'], passage)
                  and not re.search(r'\b(?:no|not|incomplete|pursuing|enrolled|expected|candidate|without|dropped out)\b', passage, re.I)]
    overlaps = [len(req_words & index['words'][i]) if eligible[i] else 0 for i, passage in enumerate(passages)]
    candidates = [i for i in range(len(passages)) if eligible[i]] or list(range(len(passages)))
    best = max(candidates, key=lambda i: (i in equivalent, len(set(named) & positive[i]),
                                       education and bool(education_mentions(passages[i])[0]), overlaps[i], float(similarities[i])))
    similarity = float(similarities[best])
    notes = list(requirement.get('extractionNotes', []))
    # High similarity without either topical overlap or the relevant section is
    # not enough to present unrelated hobbies/contacts as supporting evidence.
    relevant = bool(eligible[best] and (set(named) & positive[best] or overlaps[best] or best in equivalent))
    if not named and not education and sections[best] in ('experience', 'projects') and similarity >= THRESHOLDS['strong']:
        relevant = True  # contextual paraphrase in a substantive work section
    contextual = relevant and similarity >= THRESHOLDS['possible']
    kind = 'contextual' if contextual else 'not_evidenced'
    basis = 'contextual' if contextual else 'insufficient_evidence'
    if not relevant and similarity >= THRESHOLDS['strong']:
        kind = 'uncertain'
        notes.append('High similarity has no independently relevant topical evidence; do not treat the nearest passage as support.')
    if named and matched:
        basis = 'explicit_skills'
        kind = 'explicit' if not missing and requirement['category'] == 'technical' else 'contextual'
        notes.append('Explicit mentions support skill coverage, not proficiency or depth of experience.')
    if alternatives:
        notes.append('An OR alternative is explicitly mentioned; unused alternatives are not treated as missing obligations.')
    if missing:
        notes.append('Skill conditions without affirmative evidence: ' + '; '.join(' or '.join(c['anyOf']) for c in conditions if not c['satisfied']) + '.')
    if education:
        notes.append('Degree/field text is self-reported. Completion, accreditation and eligibility are not independently verified.')
        if equivalent:
            kind, basis, relevant = 'explicit', 'explicit_education', True
        elif relevant and (contextual or education_mentions(passages[best])[0]):
            kind = 'uncertain'
    if requirement['category'] == 'experience':
        notes.append('Verify duration, field and scope manually; a related passage does not establish the requested years.')
        if contextual or matched:
            kind = 'uncertain'
    if re.search(r'\b(?:expert|advanced|proficien\w*|deep|extensive|strong|certif\w*|hands[- ]on)\b', requirement['text'], re.I):
        notes.append('The requested proficiency or certification requires evidence beyond a skill mention.')
        if matched or contextual:
            kind = 'uncertain'
    # A requirement can have other conjunctive conditions beyond its skill list.
    if named and kind == 'explicit' and re.search(r'\b(?:and|with)\s+(?:the ability|ability|a degree|\d|certif)|\b(?:years?|degree|certif\w*)\b', requirement['text'], re.I):
        notes.append('This item includes an additional condition beyond the named skills; verify each clause.')
        kind = 'uncertain'
    if named and kind == 'explicit' and any(content_words(clause) and not extract_skills(clause)
                                            for clause in re.split(r'\band\b|,', requirement['text'], flags=re.I)):
        notes.append('An additional clause is outside the named-skill checks; verify it separately.')
        kind = 'uncertain'
    if re.search(r'\b(?:learning|plan to|interested in|want to|beginner|tutorial|pursuing|expected|enrolled)\b', passages[best], re.I) and relevant:
        notes.append('This passage may describe learning, intent, or an unfinished qualification.')
        kind = 'uncertain'
    negated = [skill for skill in named if any(skill in negated for negated in index['negative'])]
    if negated and not matched:
        notes.append('A skill mention is negated; it was not counted as positive evidence.')
        kind = 'uncertain'
    if re.search(r'\b(?:no|not|without|never|lack)\b', passages[best], re.I) and contextual and (not named or not matched):
        notes.append('Potential negation in the evidence needs manual review.')
        kind = 'uncertain'
    if requirement.get('extractionConfidence') == 'uncertain':
        kind = 'uncertain'
    if not named and contextual and not equivalent:
        notes.append('Contextual similarity is a lead for review, not confirmation of the requirement.')
    if kind == 'not_evidenced':
        notes.append('No sufficiently relevant supporting evidence was found; absence from the resume is not proof of inability.')
    hybrid_status = {'explicit': 'supported', 'contextual': 'uncertain', 'uncertain': 'uncertain', 'not_evidenced': 'missing'}[kind]
    return {
        'requirement': requirement['text'], 'category': requirement['category'], 'priority': requirement['priority'],
        'sourceSection': requirement.get('sourceSection'), 'extractionConfidence': requirement.get('extractionConfidence', 'explicit'),
        'similarity': similarity, 'status': match_status(similarity), 'hybridStatus': hybrid_status,
        'evidenceKind': kind, 'basis': basis, 'matchedSkills': matched, 'missingSkills': missing,
        'alternativeSkills': alternatives, 'skillConditions': conditions,
        'skillEvidence': skill_evidence, 'uncertainty': notes,
        # Keep the legacy nearest passage for API compatibility, but explicitly
        # flag irrelevant text so the dashboard never presents it as support.
        'evidence': {'text': passages[best], 'passageIndex': best, 'section': sections[best], 'relevant': relevant},
    }
