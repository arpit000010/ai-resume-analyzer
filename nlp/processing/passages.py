import re

class PassageLimitError(ValueError):
    pass

def split_passages(text, max_passages, tokenizer=None, token_budget=254):
    """Keep source wording; split sentences/bullets and bound long passages.

    Token offsets additionally split at the model's actual token limit rather
    than allowing SentenceTransformer.encode to silently truncate evidence.
    """
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Bullets and paragraphs delimit requirements; single PDF line wraps join.
    blocks = re.split(r"\n\s*(?:[-*•]|\d+[.)])\s+|\n\s*\n", text)
    passages = []
    seen = set()
    for block in blocks:
        block = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", block)
        block = re.sub(r"\s+", " ", block).strip()
        for sentence in re.split(r"(?<=[.!?;])\s+(?=[A-Z0-9])", block):
            # Slice at whitespace where practical; never drop long unbroken words.
            while sentence:
                end = min(len(sentence), 600)
                if end < len(sentence):
                    space = sentence.rfind(" ", 0, end + 1)
                    if space > 0:
                        end = space
                chunk = sentence[:end].strip()
                sentence = sentence[end:].strip()
                chunks = [chunk]
                if tokenizer is not None:
                    if token_budget < 1:
                        raise ValueError("Invalid tokenizer budget")
                    chunks = []
                    while chunk:
                        offsets = tokenizer(chunk, add_special_tokens=False, return_offsets_mapping=True)["offset_mapping"]
                        if len(offsets) <= token_budget:
                            chunks.append(chunk)
                            break
                        end = offsets[token_budget][0]
                        candidate = chunk[:end].strip()
                        # Subword pieces can tokenize differently at a new edge.
                        # Recheck each exact slice before it reaches encode().
                        while candidate and len(tokenizer(candidate, add_special_tokens=False, return_offsets_mapping=True)["offset_mapping"]) > token_budget:
                            end -= 1
                            candidate = chunk[:end].strip()
                        if not candidate or end <= 0:
                            raise ValueError("Tokenizer could not split this passage")
                        chunks.append(candidate)
                        chunk = chunk[end:].strip()
                for passage in chunks:
                    if not passage or not any(c.isalnum() for c in passage) or passage.casefold() in seen:
                        continue
                    seen.add(passage.casefold())
                    passages.append(passage)
                    if len(passages) > max_passages:
                        raise PassageLimitError("Too many passages. Shorten the resume or job description; no passages were silently dropped.")
    return passages



# Section labels are structural metadata, never evidence by themselves.
SECTIONS = {
    'skills': r'(?:technical |core |programming |professional )?skills|programming languages|technologies|competencies',
    'experience': r'(?:work |professional |employment |relevant |industry )?experience|employment(?: history)?|work history|internships?',
    'education': r'education|academic(?: background| qualifications?)?|qualifications',
    'projects': r'(?:academic |personal |selected |relevant )?projects',
    'certifications': r'certifications?|licenses?',
    'summary': r'summary|profile|professional summary|objective',
    'contact': r'contact(?: details| information)?|personal details|references',
    'interests': r'(?:personal )?interests|hobbies|hobbies and interests',
}


def resume_records(text, max_passages, tokenizer=None, token_budget=254):
    """Return eligible evidence with its source section; filter contact/hobby noise."""
    records, buffer, seen = [], [], set()
    section = 'unspecified'

    def flush():
        if not buffer:
            return
        raw = ' '.join(buffer)
        buffer.clear()
        if section in ('contact', 'interests'):
            return
        for passage in split_passages(raw, max_passages, tokenizer, token_budget):
            from nlp.processing.skills import extract_skills
            from nlp.processing.education import education_mentions
            if re.search(r'[\w.+-]+@[\w.-]+\.[a-z]{2,}', passage, re.I):
                continue
            if re.fullmatch(r'(?:(?:phone|tel|mobile)[: ]*)?[+()\d .-]{7,}', passage, re.I):
                continue
            if re.fullmatch(r'(?:(?:github|linkedin|website|portfolio)[: ]*)?(?:https?://|www\.)\S+', passage, re.I):
                continue
            if section == 'unspecified' and not extract_skills(passage) and not education_mentions(passage)[0]:
                if re.fullmatch(r'[A-Z][a-z]+(?: [A-Z][a-z]+){0,3}', passage):
                    continue  # likely an unsectioned name, not a resume claim
            key = (section, passage.casefold())
            if key not in seen:
                seen.add(key)
                records.append({'text': passage, 'section': section})
                if len(records) > max_passages:
                    raise PassageLimitError('Too many resume passages; shorten the document. None were silently dropped.')

    for raw in text.replace('\r\n', '\n').replace('\r', '\n').split('\n'):
        line = re.sub(r'^#{1,6}\s*', '', raw.strip()).strip()
        if not line:
            flush()
            continue
        inline = re.match(r'^([^:]{2,45}):\s*(.*)$', line)
        label = (inline[1] if inline else line).strip().casefold()
        kind = next((key for key, pattern in SECTIONS.items() if re.fullmatch(pattern, label)), None)
        if kind:
            flush()
            section = kind
            if inline and inline[2]:
                buffer.append(inline[2])
            continue
        # Unbulleted uppercase starts usually introduce a new resume claim;
        # lowercase lines continue a PDF line wrap. Bullet prefixes always split.
        if re.match(r'^[-*•–]\s+', line) or (buffer and re.match(r'^[A-Z0-9]', line)):
            flush()
        buffer.append(line)
    flush()
    return records


def resume_passages(text, max_passages, tokenizer=None, token_budget=254):
    """Stable text-only interface retained for existing callers."""
    return [item['text'] for item in resume_records(text, max_passages, tokenizer, token_budget)]
