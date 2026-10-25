"""Compatibility imports for the Sprint 2 public Python interface."""
from nlp.config import MODEL_ID, MODEL_REVISION
from nlp.processing.passages import PassageLimitError, split_passages
from nlp.matching.similarity import cosine_matrix, match_status
from nlp.matching.engine import SemanticEngine
