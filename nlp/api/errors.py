from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

def register_errors(app):
    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        # Pydantic's default errors may echo the entire resume. Never return it.
        return JSONResponse({"error": {"code": "INVALID_INPUT", "message": "Provide readable resumeText (1–60,000 characters) and jobDescription (20–20,000 characters), with no extra fields."}}, status_code=422)

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        return JSONResponse({"error": error.detail}, status_code=error.status_code)

