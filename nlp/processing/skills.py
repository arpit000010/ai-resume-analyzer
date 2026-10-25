"""Both runtimes consume shared/skills.json; no Python-specific skill list."""
import json
import re
import unicodedata
from pathlib import Path

DEFINITIONS = json.loads((Path(__file__).resolve().parents[2] / 'shared' / 'skills.json').read_text())
PATTERNS = {
    item['name']: re.compile(
        r'(?<![\w+#.])(?:' + '|'.join(re.escape(alias).replace(r'\ ', r'\s+') for alias in [item['name'], *item['aliases']]) + r')(?![\w+#])', re.I
    ) for item in DEFINITIONS
}
TECHNICAL = {item['name'] for item in DEFINITIONS if item.get('category', 'technical') == 'technical'}


def skill_matching_text(text):
    """Keep academic communication fields distinct from interpersonal skills.

    Preserve character offsets so conditions and negation use the same hits.
    Standalone communication requirements elsewhere in the text stay intact.
    """
    text = unicodedata.normalize('NFKC', text)
    return re.sub(r'\b(?:electronics?\s+(?:and|&|/)\s*communications?(?:\s+engineering)?|communications?\s+engineering)\b',
                  lambda match: ' ' * len(match[0]), text, flags=re.I)


def extract_skills(text):
    text = skill_matching_text(text)
    return [name for name, pattern in PATTERNS.items() if pattern.search(text)]


def skill_is_negated(text, skill):
    """Conservative local negation guard, not a general language parser."""
    text = skill_matching_text(text)
    hits = list(PATTERNS[skill].finditer(text))
    if not hits:
        return False
    def negated(hit):
        before = text[max(0, hit.start() - 70):hit.start()]
        before = re.split(r'[.;!?\n]|\bbut\b|\bhowever\b', before, flags=re.I)[-1]
        before = re.sub(r'\bnot only\b', '', before, flags=re.I)
        after = text[hit.end():hit.end() + 40]
        return bool(re.search(r'\b(?:no|not|without|lack(?:ing)?|never|unfamiliar)\b[^.;!?\n]{0,55}$', before, re.I)
                    or re.match(r'\s+(?:is |are )?(?:not required|not used|unfamiliar)\b', after, re.I))
    # Any affirmative occurrence is evidence of a mention; still not proficiency.
    return all(negated(hit) for hit in hits)
