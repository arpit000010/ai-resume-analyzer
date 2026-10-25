import logging
from contextlib import asynccontextmanager
from threading import Lock
from fastapi import FastAPI
from starlette.concurrency import run_in_threadpool
from nlp.config import MAX_BODY_BYTES
from nlp.models.loader import load_engine
from nlp.api.body_limit import BodyLimit
from nlp.api.errors import register_errors
from nlp.api.routes import router

def create_app(loader=load_engine):
    @asynccontextmanager
    async def lifespan(app):
        app.state.engine = None
        app.state.busy = Lock()
        try:
            app.state.engine = await run_in_threadpool(loader)
        except Exception:
            # Do not expose paths, documents, or model-loader internals in responses.
            logging.getLogger(__name__).error("NLP model unavailable; cache the model and restart the service.")
        yield
        app.state.engine = None

    app = FastAPI(title="Local Resume Semantic Matcher", lifespan=lifespan)
    app.add_middleware(BodyLimit)
    register_errors(app)
    app.include_router(router)

    return app

app = create_app()
