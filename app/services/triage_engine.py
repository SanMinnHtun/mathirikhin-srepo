"""Deterministic and Gemini-backed symptom triage engine."""

from __future__ import annotations

import json
import os
import re

from google import genai
from google.genai import types

from app.schemas.symptoms import (
    SeniorAnalysisRequest,
    SeniorAnalysisResponse,
    SymptomAnalysisRequest,
    SymptomAnalysisResponse,
)

_SENIOR_SYSTEM_INSTRUCTION = """
You are CareAI, an informational symptom guide that specializes in empathetic,
respectful communication with older adults. Use short, clear, warm sentences at
an 8th-grade reading level. Avoid medical jargon, or explain it in plain English
immediately. Do not diagnose, promise safety, prescribe treatment, or advise
starting, stopping, or changing medicine. Be cautious when choosing urgency and
include practical next steps. Always include prominent warning signs that need
urgent care and explain that this information does not replace medical advice.

Set urgency_badge_color strictly from urgency: "Routine" -> "green",
"See a doctor soon" -> "yellow", and "Seek immediate attention" -> "red".
Possible conditions must be framed as possibilities, never as a diagnosis.
""".strip()

_SENIOR_URGENCY_COLORS = {
    "Routine": "green",
    "See a doctor soon": "yellow",
    "Seek immediate attention": "red",
}

_UNSAFE_SENIOR_OUTPUT_PATTERNS = (
    re.compile(r"\b(?:you (?:definitely )?have|diagnosed with|this proves)\b", re.IGNORECASE),
    re.compile(r"\b(?:you are (?:definitely )?safe|nothing to worry about)\b", re.IGNORECASE),
    re.compile(
        r"\b(?:prescrib(?:e|ed|ing)|start|stop|change|increase|decrease)\s+"
        r"(?:taking\s+)?(?:your\s+)?(?:medication|medicine|drug|dose|dosage)\b",
        re.IGNORECASE,
    ),
)

_EMERGENCY_KEYWORDS = {
    "chest pain", "shortness of breath", "trouble breathing", "severe bleeding",
    "fainting", "stroke", "slurred speech", "face drooping", "unconscious",
    "loss of consciousness", "severe allergic reaction", "anaphylaxis", "suicidal",
    "seizure", "heavy bleeding",
}

_URGENT_KEYWORDS = {
    "fever", "vomiting", "infection", "sprain", "worsening pain",
    "persistent headache", "nausea", "diarrhea", "rash", "swelling",
    "dehydration", "dizziness", "cough",
}


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9\s]", " ", value.lower()).strip()


def _build_burmese_response(triage_level: str, symptom_text: str) -> tuple[str, list[str]]:
    if triage_level == "EMERGENCY":
        return (
            "အရေးပေါ်စစ်ဆေးမှုတောင်းခံရန် လိုအပ်သည်။ အခြေအနေမကောင်းလျှင် အရေးပေါ်ဝန်ဆောင်မှုကို တိုက်ရိုက်ဆက်သွယ်ပါ။",
            ["အသက်အန္တရာ ကင်းရှင်းရေးအတွက် အရေးပေါ်ကူညီမှူ", "ခါးပတ်နာကျင်မှု၊ အသက်ရှုခက်ခဲမှု သို့မဟုတ် နာကျင်မှု အလွန်ပြင်းထန်ခြင်း"],
        )
    if triage_level == "URGENT":
        return (
            "စာမေးပွဲဆရာဝန် သို့မဟုတ် ဆေးရုံသို့ အမြန်တင်ပို့ရန် အကြံပြုပါသည်။",
            ["အအေးမိမှု၊ အာသက်မြန်မှု သို့မဟုတ် ရောဂါလက္ခဏာများ", "အချိန်မရွေး စောင့်ကြည့်မိန့်ခြင်း"],
        )
    return (
        "မိုးကာကွယ်မှုအတွက် အိမ်တွင် စောင့်ကြည့်နိုင်ပြီး အခြေအနေမကောင်းလာပါက ပြန်လည်သုံးသပ်ပါ။",
        ["အိမ်တွင် စောင့်ကြည့်မည်", "လက္ခဏာများ ပိုဆိုးလာပါက ဆေးပညာရှင်ကို မေးမြန်းရန်"],
    )


def _build_english_response(triage_level: str) -> tuple[str, list[str]]:
    if triage_level == "EMERGENCY":
        return (
            "This may require immediate emergency assessment. Seek emergency care now if symptoms are severe or worsening.",
            ["Chest pain or breathing difficulty", "Severe bleeding or fainting"],
        )
    if triage_level == "URGENT":
        return (
            "This needs prompt medical assessment, especially if symptoms worsen or persist.",
            ["Fever, vomiting, or infection signs", "Persistent or worsening symptoms"],
        )
    return (
        "These symptoms may be manageable with home monitoring, but re-evaluate if they worsen.",
        ["Mild symptoms that can be monitored at home", "Escalate if pain or symptoms become severe"],
    )


def evaluate_symptoms_rule_based(request: SymptomAnalysisRequest) -> SymptomAnalysisResponse:
    """Return deterministic triage without calling external AI services."""
    normalized_text = _normalize_text(request.symptoms_text)
    emergency_hit = request.severity_score >= 8 or any(
        keyword in normalized_text for keyword in _EMERGENCY_KEYWORDS
    )
    urgent_hit = (
        request.severity_score >= 5
        or request.duration_days >= 7
        or any(keyword in normalized_text for keyword in _URGENT_KEYWORDS)
    )
    if emergency_hit:
        triage_level = "EMERGENCY"
    elif urgent_hit:
        triage_level = "URGENT"
    else:
        triage_level = "SELF_CARE"

    color_map = {"EMERGENCY": "red", "URGENT": "yellow", "SELF_CARE": "green"}
    if request.language.lower() in {"my", "burmese"}:
        summary_statement, considerations = _build_burmese_response(triage_level, normalized_text)
    else:
        summary_statement, considerations = _build_english_response(triage_level)
    return SymptomAnalysisResponse(
        triage_level=triage_level,
        urgency_badge_color=color_map[triage_level],
        summary_statement=summary_statement,
        possible_considerations=considerations,
    )


def analyze_senior_symptoms(request: SeniorAnalysisRequest) -> SeniorAnalysisResponse:
    """Analyze symptom details with Gemini and validate its structured response."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("The symptom analysis provider is not configured.")

    client = genai.Client(api_key=api_key)
    patient_details = {
        "body_parts": request.body_parts,
        "pain_sensations": request.pain_sensations,
        "pain_severity": request.pain_severity,
        "duration": request.duration,
        "gender": request.gender,
        "age": request.age,
    }
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=json.dumps(patient_details, ensure_ascii=False),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SeniorAnalysisResponse,
            temperature=0.2,
            system_instruction=_SENIOR_SYSTEM_INSTRUCTION,
        ),
    )

    parsed = getattr(response, "parsed", None)
    if parsed is None:
        response_text = getattr(response, "text", None)
        if not isinstance(response_text, str) or not response_text.strip():
            raise ValueError("The symptom analysis provider returned no result.")
        parsed = json.loads(response_text)

    if isinstance(parsed, SeniorAnalysisResponse):
        result_data = parsed.model_dump()
    elif isinstance(parsed, dict):
        result_data = parsed
    else:
        raise ValueError("The symptom analysis provider returned an invalid result.")

    urgency = result_data.get("urgency")
    if urgency not in _SENIOR_URGENCY_COLORS:
        raise ValueError("The symptom analysis provider returned an invalid urgency.")
    result_data["urgency_badge_color"] = _SENIOR_URGENCY_COLORS[urgency]
    result = SeniorAnalysisResponse.model_validate(result_data)

    displayed_text = [
        result.summary,
        *(condition.name for condition in result.possible_conditions),
        *(condition.explanation for condition in result.possible_conditions),
        *result.red_flags,
        *result.recommended_actions,
    ]
    if any(
        pattern.search(text)
        for text in displayed_text
        for pattern in _UNSAFE_SENIOR_OUTPUT_PATTERNS
    ):
        raise ValueError("The symptom analysis provider returned unsafe medical wording.")
    return result