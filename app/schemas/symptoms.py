"""Request and response models for symptom analysis APIs."""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SymptomAnalysisRequest(BaseModel):
    """Validated symptom details submitted for deterministic triage."""

    model_config = ConfigDict(extra="forbid")

    symptoms_text: str = Field(..., min_length=3)
    duration_days: int = Field(default=1, ge=1, le=365)
    severity_score: int = Field(default=5, ge=1, le=10)
    language: str = Field(default="en")


class SymptomAnalysisResponse(BaseModel):
    """Determistic triage result with a strict badge-to-level mapping."""

    model_config = ConfigDict(extra="forbid")

    triage_level: Literal["EMERGENCY", "URGENT", "SELF_CARE"]
    urgency_badge_color: str
    summary_statement: str
    possible_considerations: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_badge_matches_triage(self) -> "SymptomAnalysisResponse":
        expected_colors = {
            "EMERGENCY": "red",
            "URGENT": "yellow",
            "SELF_CARE": "green",
        }
        if self.urgency_badge_color != expected_colors[self.triage_level]:
            raise ValueError(
                "urgency_badge_color must match triage_level: "
                f"{self.triage_level} -> {expected_colors[self.triage_level]}"
            )
        return self


class SeniorAnalysisRequest(BaseModel):
    """Validated inputs for the senior-friendly symptom checker."""

    model_config = ConfigDict(extra="forbid")

    body_parts: list[str] = Field(..., min_length=1)
    pain_sensations: list[str] = Field(..., min_length=1)
    pain_severity: int = Field(..., ge=1, le=10)
    duration: str = Field(..., min_length=1)
    gender: str = Field(..., min_length=1)
    age: Optional[int] = Field(default=None, ge=1, le=120)


class PotentialCondition(BaseModel):
    """A cautious, non-diagnostic possible explanation."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=120)
    explanation: str = Field(..., min_length=1, max_length=800)


class SeniorAnalysisResponse(BaseModel):
    """Structured, informational symptom analysis for the senior UI."""

    model_config = ConfigDict(extra="forbid")

    urgency: Literal["Routine", "See a doctor soon", "Seek immediate attention"]
    urgency_badge_color: Literal["green", "yellow", "red"]
    summary: str = Field(..., min_length=1, max_length=1200)
    possible_conditions: list[PotentialCondition] = Field(..., max_length=8)
    red_flags: list[str] = Field(..., max_length=10)
    recommended_actions: list[str] = Field(..., max_length=10)

    @model_validator(mode="after")
    def validate_badge_matches_urgency(self) -> "SeniorAnalysisResponse":
        expected_colors = {
            "Routine": "green",
            "See a doctor soon": "yellow",
            "Seek immediate attention": "red",
        }
        if self.urgency_badge_color != expected_colors[self.urgency]:
            raise ValueError(
                "urgency_badge_color must match urgency: "
                f"{self.urgency} -> {expected_colors[self.urgency]}"
            )
        return self