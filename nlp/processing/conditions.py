"""Explicit AND/OR skill groups, including repeated obligations and comma lists."""
import re
from nlp.processing.skills import PATTERNS, skill_matching_text


def skill_groups(text, skills):
    normalized = skill_matching_text(text)
    hits = sorted((hit.start(), hit.end(), skill) for skill in skills for hit in PATTERNS[skill].finditer(normalized))
    if not hits:
        return []
    connectors = [re.sub(r'[()]', '', normalized[left[1]:right[0]]).strip() for left, right in zip(hits, hits[1:])]
    is_or = lambda value: bool(re.fullmatch(r',?\s*(?:or|and/or|/)', value, re.I))
    is_comma = lambda value: value == ','
    edges = []
    for index, connector in enumerate(connectors):
        alternative = is_or(connector)
        if is_comma(connector):
            # Comma-separated alternatives inherit a final "or", stopping at
            # an AND or any intervening prose rather than mixing other clauses.
            left = index
            right = index
            while left > 0 and (is_comma(connectors[left - 1]) or is_or(connectors[left - 1])):
                left -= 1
            while right + 1 < len(connectors) and (is_comma(connectors[right + 1]) or is_or(connectors[right + 1])):
                right += 1
            alternative = any(is_or(value) for value in connectors[left:right + 1])
        edges.append(alternative)
    groups = [[hits[0][2]]]
    for index, (_, _, skill) in enumerate(hits[1:]):
        if edges[index]:
            if skill not in groups[-1]:
                groups[-1].append(skill)
        else:
            groups.append([skill])
    return groups
