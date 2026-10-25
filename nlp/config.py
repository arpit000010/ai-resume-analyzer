"""Shared limits and model identity for the local NLP service."""
MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
MODEL_REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
THRESHOLDS = {"strong": 0.65, "possible": 0.40}
MAX_RESUME_CHARS = 60000
MAX_JD_CHARS = 20000
MAX_RESUME_PASSAGES = 160
MAX_JD_PASSAGES = 80
EXPLANATION = (
    "Requirements are filtered and grouped using inspectable rules. Explicit affirmative skill mentions "
    "take precedence over embedding similarity for skill coverage, but never prove proficiency. "
    "Supported means explicit skill evidence; uncertain means contextual or incomplete evidence; "
    "missing means no relevant evidence found. Required/preferred labels come from wording and section headings. "
    "Cosine values (-1 to 1) and legacy strong >= 0.65 / possible >= 0.40 / weak statuses remain separate "
    "uncalibrated retrieval signals, not percentages or hiring predictions. Review the source JD and evidence."
)

MAX_BODY_BYTES = 1000000


def model_settings(allow_download=None):
    import os
    threads = int(os.getenv('NLP_CPU_THREADS', '2'))
    if not 1 <= threads <= 8:
        raise ValueError('NLP_CPU_THREADS must be between 1 and 8')
    return {
        'threads': threads,
        'download': allow_download if allow_download is not None else os.getenv('NLP_ALLOW_DOWNLOAD', 'false').lower() == 'true',
        'revision': os.getenv('NLP_MODEL_REVISION') or MODEL_REVISION,
        'cache': os.getenv('NLP_MODEL_CACHE', '.models'),
    }
