from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from nlp.config import MODEL_ID
from nlp.schemas import MatchInput, MatchOutput
from nlp.processing.passages import PassageLimitError

router = APIRouter()

@router.get("/health/live")
def live():
    return {"status": "ok"}

@router.get("/health/ready")
def ready(request: Request):
    loaded = request.app.state.engine is not None
    return JSONResponse({"status": "ready" if loaded else "unavailable", "model": MODEL_ID}, status_code=200 if loaded else 503)

@router.post("/match", response_model=MatchOutput)
def match(payload: MatchInput, request: Request):
    engine = request.app.state.engine
    if engine is None:
        raise HTTPException(503, {"code": "MODEL_UNAVAILABLE", "message": "Cache the model and restart the NLP service."})
    if not request.app.state.busy.acquire(blocking=False):
        raise HTTPException(503, {"code": "NLP_BUSY", "message": "Semantic inference is busy. Retry shortly."})
    try:
        return engine.match(payload.resumeText, payload.jobDescription)
    except PassageLimitError as error:
        raise HTTPException(422, {"code": "PASSAGE_LIMIT", "message": str(error)}) from None
    except ValueError:
        raise HTTPException(422, {"code": "UNREADABLE_PASSAGES", "message": "Cannot compare these passages. Try clearer, shorter text."}) from None
    except Exception:
        raise HTTPException(500, {"code": "INFERENCE_FAILED", "message": "Semantic inference failed. Keyword matching remains available."}) from None
    finally:
        request.app.state.busy.release()

