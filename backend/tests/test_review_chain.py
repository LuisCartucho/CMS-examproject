import pytest
from unittest.mock import patch, MagicMock
from services.review_chain import run_review

SAMPLE_RECORD = {
    "problem_description": "Sailor fell from ladder with chest pain",
    "airway": {"clear_airways": True, "oxygen_lmin": 5.0, "oxygen_device": "nasal_cannula"},
    "breathing": {"breathing_description": "shallow", "breaths_per_min": 22, "oxygen_saturation_pct": 91},
    "circulation": {"pulse_per_min": 110, "skin_color": "pale", "capillary_response_sec": 3.0,
                    "blood_pressure_systolic": 90, "blood_pressure_diastolic": 60},
    "disability": {"consciousness_level": 2, "convulsions": False, "paralysis": False},
    "expose": {"temperature_mouth": 37.2, "injury_description": "Bruising on left chest"},
    "pre_contact_medications": [],
}

MOCK_LLM_RESPONSE = '''{
    "deficiencies": [
        {
            "section": "C",
            "field": "blood_pressure_systolic",
            "severity": "CRITICAL",
            "description": "Blood pressure is critically low",
            "recommendation": "Monitor blood pressure closely"
        }
    ],
    "overall_assessment": "Patient shows signs of shock after trauma.",
    "completeness_score": 0.7,
    "clinical_safety_score": 0.5
}'''

def test_run_review_returns_dict():
    with patch("services.review_chain.review_chain") as mock_chain:
        mock_chain.invoke.return_value = MOCK_LLM_RESPONSE
        result = run_review(SAMPLE_RECORD, "test-session-001")
        assert isinstance(result, dict)

def test_run_review_has_deficiencies():
    with patch("services.review_chain.review_chain") as mock_chain:
        mock_chain.invoke.return_value = MOCK_LLM_RESPONSE
        result = run_review(SAMPLE_RECORD, "test-session-002")
        assert "deficiencies" in result

def test_run_review_has_scores():
    with patch("services.review_chain.review_chain") as mock_chain:
        mock_chain.invoke.return_value = MOCK_LLM_RESPONSE
        result = run_review(SAMPLE_RECORD, "test-session-003")
        assert "completeness_score" in result
        assert "clinical_safety_score" in result

def test_run_review_scores_are_floats():
    with patch("services.review_chain.review_chain") as mock_chain:
        mock_chain.invoke.return_value = MOCK_LLM_RESPONSE
        result = run_review(SAMPLE_RECORD, "test-session-004")
        assert isinstance(result["completeness_score"], float)
        assert isinstance(result["clinical_safety_score"], float)

def test_run_review_has_assessment():
    with patch("services.review_chain.review_chain") as mock_chain:
        mock_chain.invoke.return_value = MOCK_LLM_RESPONSE
        result = run_review(SAMPLE_RECORD, "test-session-005")
        assert "overall_assessment" in result
        assert len(result["overall_assessment"]) > 0