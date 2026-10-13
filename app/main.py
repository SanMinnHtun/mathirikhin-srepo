"""FastAPI application entry point for the CareAI symptom analyzer."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load root .env before importing routers or services that read configuration.
from app.core import config as _config  # noqa: F401
from app.routers.symptoms import router as symptoms_router


app = FastAPI(title="CareAI Symptom Analyzer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(symptoms_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Simple health check endpoint."""
    return {"status": "ok"}
