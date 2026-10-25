from nlp.config import THRESHOLDS

def cosine_matrix(vectors, requirement_count):
    """Compute the actual retrieval matrix; validate rather than hiding NaNs."""
    import numpy as np
    matrix = np.asarray(vectors, dtype=np.float32)
    if matrix.ndim != 2 or matrix.shape[1] == 0 or not np.isfinite(matrix).all():
        raise ValueError("Invalid embedding matrix")
    if not 0 < requirement_count < len(matrix):
        raise ValueError("Invalid requirement count")
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    if not np.isfinite(norms).all() or (norms == 0).any():
        raise ValueError("Invalid embedding norms")
    matrix = matrix / norms
    return np.clip(matrix[:requirement_count] @ matrix[requirement_count:].T, -1, 1)


def match_status(similarity):
    if similarity >= THRESHOLDS["strong"]:
        return "strong"
    if similarity >= THRESHOLDS["possible"]:
        return "possible"
    return "weak"

