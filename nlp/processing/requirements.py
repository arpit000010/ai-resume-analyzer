"""Structure-aware JD extraction with visible uncertainty, not a sentence counter."""
import re
import unicodedata
from nlp.processing.passages import split_passages
from nlp.processing.skills import extract_skills, TECHNICAL

HEADINGS = {
    'required': r'(?:minimum|basic|required|mandatory|essential) (?:technical )?(?:qualifications|requirements|eligibility|skills)(?: and skills)?|(?:(?:technical|job) )?requirements|what (?:we need|you need|you bring)(?: to see)?|what you must have|must have|essential(?: skills)?',
    'preferred': r'(?:preferred|desirable|bonus)(?: (?:technical )?(?:qualifications|requirements|skills))?|nice to have|ways to stand out(?: from the crowd)?|what (?:will|would) make you stand out',
    'qualification': r'(?:additional )?(?:qualifications|eligibility|skills|technical skills|education|skills and experience)',
    'optional': r'optional(?: skills| qualifications| requirements)?',
    'responsibility': r'(?:key |job |your )?responsibilities|(?:your |the )?role|what you(?: will|[’\']ll) (?:do|be doing|be working on)',
    'exclude': r'about(?: .+)?|who we are|(?:our )?(?:team|company|department)(?: overview| description)?|(?:our )?(?:benefits|culture|mission|values)|what we offer|equal (?:employment )?opportunity(?: employer)?|compensation|salary|perks|how to apply',
}
CUE = re.compile(r'\b(?:required|must|proficien\w*|knowledge|experience|familiar\w*|ability|understanding|expertise|degree|bachelor\w*|master\w*|ph\.?d|b\.?\s*tech|b\.?\s*e\b|years?|skills|background|comfortable|certif\w*|eligible|eligibility)\b', re.I)
ACTION = re.compile(r'^(?:(?:you(?: will|[’\']ll)|the candidate will)\s+)?(?:build|develop|design|debug|implement|maintain|manage|lead|optimi[sz]e|collaborate|deliver|create|test|write|work|analy[sz]e|support|troubleshoot|architect|drive)\b', re.I)
FILLER = re.compile(r'^(?:we (?:are(?! looking| seeking)|offer|believe|use|build|have)|we[’\']re(?! looking| seeking)|our (?:team|company|mission|culture)|\w+ is (?:a |an )?(?:global |leading |technology |company )|join (?:us|our)|apply (?:now|today)|equal opportunity|all qualified applicants|reasonable accommodation|the (?:base salary|company)|salary range|an exciting opportunity|passion for innovation)\b', re.I)
FRAGMENT = re.compile(r'^(?:must|required|preferred|qualifications?|requirements?|skills?|and|or|a must|is a must|a plus|etc)[.!:;\s]*$', re.I)
METADATA = re.compile(r'^(?:(?:job|role) title|(?:work |job )?location|employment(?: type)?|job type|job id|requisition(?: id)?|posted(?: on)?|apply by|department|team|work mode|schedule|salary|compensation)\s*(?::|[-–]|\s{2,})|^(?:full[- ]time|part[- ]time|remote|hybrid|on[- ]site)\s*$', re.I)
ROLE = re.compile(r'^(?:(?:senior|junior|staff|principal|graduate|systems|software|hardware|backend|frontend|full stack|machine learning|core|platform|research|data|embedded|engineer|engineering|developer|development|scientist|analyst|team|intern|manager|lead|ii|iii|iv)\s*){1,9}$', re.I)
BULLET = re.compile(r'^(?:[-*+•–]\s+|\d+[.)]\s+|[-*]\s*\[[ xX]\]\s*)')


def clean_markup(text):
    text = unicodedata.normalize('NFKC', text).replace('\r\n', '\n').replace('\r', '\n').replace('\u00a0', ' ')
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    return re.sub(r'\s+', ' ', re.sub(r'[*_`]{1,3}', '', text)).strip()


def heading_kind(text):
    label = re.sub(r'^#{1,6}\s*', '', clean_markup(text)).rstrip(':').strip().lower()
    return next((kind for kind, pattern in HEADINGS.items() if re.fullmatch(pattern, label)), None)


def categorize(text, skills):
    if re.search(r'\b(?:degree|bachelor\w*|master\w*|ph\.?\s*d|university|college|education|[bm]\.?(?:\s*tech|\s*sc|\s*eng|\s*e\b)|b\.?s\.?|m\.?s\.?)\b', text, re.I):
        return 'education'
    if re.search(r'\b(?:\d+\+?\s*(?:years?|yrs?)|professional experience|industry experience|years? of experience)\b', text, re.I):
        return 'experience'
    if set(skills) & TECHNICAL or re.search(r'\b(?:systems?|software|hardware|databases?|interfaces|services|firmware|drivers?|kernel|programming)\b', text, re.I):
        return 'technical'
    return 'other'


def extract_requirements(text, tokenizer=None, token_budget=254, max_passages=80):
    scope, section = 'unspecified', None
    buffer, candidates = [], []
    excluded = 0
    bullet_item = False

    def flush():
        nonlocal excluded, bullet_item
        if not buffer:
            return
        raw = ' '.join(buffer)
        buffer.clear()
        for passage in split_passages(raw, max_passages, tokenizer, token_budget):
            skills = extract_skills(passage)
            words = re.findall(r'[A-Za-z0-9+#]+', passage)
            cue = bool(CUE.search(passage) or ACTION.search(passage))
            if FRAGMENT.fullmatch(passage) or FILLER.search(passage) or METADATA.search(passage):
                excluded += 1
                continue
            if scope == 'exclude' and not (bullet_item and re.search(r'\b(?:must|required|proficiency|experience with)\b', passage, re.I)):
                excluded += 1
                continue
            in_qualifications = scope in ('required', 'preferred', 'optional', 'responsibility', 'qualification')
            meaningful = cue or (skills and (bullet_item or in_qualifications or len(words) >= 4))
            # Retain substantive qualification bullets even outside the taxonomy.
            # Ambiguous or incomplete wording is flagged instead of silently lost.
            if not meaningful and not (in_qualifications and len(words) >= 3):
                excluded += 1
                continue
            if len(words) < 2 and not skills:
                excluded += 1
                continue
            optional = bool(re.search(r'\b(?:optional|not (?:strictly )?(?:required|mandatory|necessary)|no .{0,35} required)\b', passage, re.I))
            preferred = bool(re.search(r'\b(?:preferred|nice to have|bonus|a plus|desirable)\b', passage, re.I))
            required = bool(re.search(r'\b(?:must|required|mandatory|essential)\b', passage, re.I))
            priority = ('optional' if optional else 'preferred' if preferred else 'required' if required else scope if scope in ('required', 'preferred', 'optional', 'responsibility') else 'unspecified')
            notes = []
            incomplete = bool(re.search(r'\b(?:with|in|of|and|or|to|including|such as)\s*[,:;.]?$', passage, re.I))
            if incomplete:
                notes.append('The JD item appears incomplete; review the original wording.')
            if not meaningful:
                notes.append('Retained from a qualification section; interpretation needs review.')
            candidates.append({'text': passage, 'category': categorize(passage, skills), 'priority': priority,
                               'skills': skills, 'sourceSection': section,
                               'extractionConfidence': 'uncertain' if incomplete or not meaningful else 'explicit' if cue else 'section',
                               'extractionNotes': notes})
        bullet_item = False

    lines = text.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    fenced = False
    for index, raw_line in enumerate(lines):
        stripped = raw_line.strip()
        if stripped.startswith(('```', '~~~')):
            flush()
            fenced = not fenced
            continue
        if fenced:
            continue
        if not stripped:
            flush()
            continue
        # Setext Markdown titles and horizontal dividers.
        if re.fullmatch(r'[-=]{3,}', stripped):
            flush()
            excluded += 1
            continue
        markdown_heading = bool(re.match(r'^#{1,6}\s+', stripped))
        is_bullet = bool(BULLET.match(stripped))
        line = clean_markup(BULLET.sub('', stripped))
        line = re.sub(r'^#{1,6}\s*', '', line).strip().rstrip('#').strip()
        kind = heading_kind(line)
        inline = re.match(r'^([^:]{3,65}):\s*(.+)$', line)
        if inline and heading_kind(inline[1]) and not markdown_heading:
            flush()
            scope, section = heading_kind(inline[1]), inline[1]
            buffer.append(inline[2])
            continue
        setext_title = index + 1 < len(lines) and bool(re.fullmatch(r'\s*[=-]{3,}\s*', lines[index + 1]))
        if kind or markdown_heading or setext_title or (line.endswith(':') and len(line) < 85):
            flush()
            scope = kind or ('required' if scope == 'required' and re.fullmatch(r'(?:technical )?skills:?', line, re.I) else 'unspecified')
            section = line.rstrip(':')[:100]
            excluded += 1
            continue
        named_team = len(line.split()) <= 10 and re.search(r'\b(?:team|department|division|group)$', line, re.I) and not CUE.search(line) and not ACTION.search(line)
        simple_metadata = re.match(r'^(?:location|employment type|job id|requisition id|work mode|department|team)\s+\S', line, re.I)
        if METADATA.search(line) or simple_metadata or (not is_bullet and (ROLE.fullmatch(line) or named_team)):
            flush()
            excluded += 1
            continue
        if is_bullet or CUE.match(line) or ACTION.match(line):
            flush()
        buffer.append(line)
        bullet_item = bullet_item or is_bullet
    flush()
    unique = {}
    rank = {'required': 0, 'responsibility': 1, 'unspecified': 2, 'preferred': 3, 'optional': 4}
    for requirement in candidates:
        key = re.sub(r'\s+', ' ', requirement['text']).casefold().rstrip(' .:;')
        previous = unique.get(key)
        if previous:
            excluded += 1
            conflict = {previous['priority'], requirement['priority']} & {'required', 'preferred', 'optional'}
            chosen = requirement if rank[requirement['priority']] < rank[previous['priority']] else previous
            if len(conflict) > 1:
                chosen['extractionNotes'] = ['Repeated with conflicting priority labels; verify the JD.']
                chosen['extractionConfidence'] = 'uncertain'
            unique[key] = chosen
        else:
            unique[key] = requirement
    if len(unique) > max_passages:
        from nlp.processing.passages import PassageLimitError
        raise PassageLimitError('Too many actual requirements. Shorten the job description; none were silently dropped.')
    return list(unique.values()), excluded
