"""Run once from the repo root: python -m nlp.download_model."""
from .model import load_engine

if __name__ == "__main__":
    engine = load_engine(allow_download=True)
    print(f"Cached and warmed {engine.model.max_seq_length}-token CPU model. No API key required.")
