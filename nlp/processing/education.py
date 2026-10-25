"""Degree/field mention normalization, not verification of academic eligibility."""
import re


def education_mentions(text):
    lower = text.casefold()
    degree = None
    if re.search(r'\b(?:ph\.?\s*d|doctorate|doctoral)\b', lower):
        degree = 'doctorate'
    elif re.search(r'\b(?:m\.?\s*(?:tech|sc|eng|s\b|e\b)|master\w*)\b', lower):
        degree = 'masters'
    elif re.search(r'\b(?:b\.?\s*(?:tech|sc|eng|s\b|e\b)|bachelor\w*)\b', lower):
        degree = 'bachelors'
    field = None
    if re.search(r'\b(?:cse|cs|computer\s+science(?:\s+(?:and\s+)?engineering)?)\b', lower):
        field = 'computer science'
    elif re.search(r'\b(?:ece|electronics(?:\s+and\s+communication)?)\b', lower):
        field = 'electronics/communication'
    elif re.search(r'\belectrical engineering\b', lower):
        field = 'electrical'
    elif re.search(r'\b(?:information technology|it)\b', lower):
        field = 'information technology'
    return degree, field


def equivalent_education(requirement, excerpt):
    needed_degree, needed_field = education_mentions(requirement)
    found_degree, found_field = education_mentions(excerpt)
    if not needed_degree or not found_degree or needed_degree != found_degree:
        return False
    def degree_family(text):
        if re.search(r'\b[mb]\.?(?:\s*tech|\s*eng|\s*e\b)\b|\b(?:bachelor|master)\w* (?:of |in )?(?:technology|engineering)\b', text, re.I):
            return 'engineering'
        if re.search(r'\b[mb]\.?(?:\s*sc|\s*s\b)\b|bachelor of science|master of science', text, re.I):
            return 'science'
        return None
    requested_family = degree_family(requirement)
    if requested_family and requested_family != degree_family(excerpt):
        return False
    # A named field cannot be satisfied by an unspecified or unrelated field.
    return bool(needed_field and needed_field == found_field)
