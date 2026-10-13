"""Symptom analysis endpoints."""

from fastapi import APIRouter, HTTPException

from app.schemas.symptoms import (
    SeniorAnalysisRequest,
    SeniorAnalysisResponse,
    SymptomAnalysisRequest,
    SymptomAnalysisResponse,
)
from app.services.triage_engine import analyze_senior_symptoms, evaluate_symptoms_rule_based


router = APIRouter(prefix="/api/symptoms", tags=["Symptom Analyzer"])


@router.post("/analyze", response_model=SymptomAnalysisResponse)
def analyze_symptoms(request: SymptomAnalysisRequest) -> SymptomAnalysisResponse:
    """Analyze the reported symptoms with a deterministic triage rule engine."""
    return evaluate_symptoms_rule_based(request)


@router.post("/analyze-senior", response_model=SeniorAnalysisResponse)
def analyze_senior(request: SeniorAnalysisRequest) -> SeniorAnalysisResponse:
    """Return a structured, senior-friendly symptom analysis."""
    try:
        return analyze_senior_symptoms(request)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Symptom analysis is temporarily unavailable. Please try again.",
        ) from None