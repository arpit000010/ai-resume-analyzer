"""Model creation is called once at application lifespan startup."""
import os
from nlp.config import MODEL_ID, model_settings
from nlp.matching.engine import SemanticEngine


def load_engine(allow_download=None):
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    import torch
    from sentence_transformers import SentenceTransformer

    settings = model_settings(allow_download)
    torch.set_num_threads(settings['threads'])
    revision = settings['revision']
    model = SentenceTransformer(
        MODEL_ID, device="cpu", cache_folder=settings['cache'],
        revision=revision, local_files_only=not settings['download'], trust_remote_code=False,
        token=False, model_kwargs={"use_safetensors": True},
    )
    model.eval()
    # Warm up on non-user text; readiness means the model can actually encode.
    model.encode(["Model readiness check."], show_progress_bar=False)
    return SemanticEngine(model, revision)
