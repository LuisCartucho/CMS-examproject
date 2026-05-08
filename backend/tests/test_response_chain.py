import pytest
from unittest.mock import patch
from services.response_chain import run_response

SAMPLE_RECORD = {
    "problem_description": "Sailor fell from ladder with chest pain",
    "airway": {"clear_airways": True, "oxygen_lmin": 5.0},
    "breathing": {"breathing_description": "shallow", "breaths_per_min": 22, "oxygen_saturation_pct": 91},
    "circulation": {"pulse_per_min": 110, "skin_color": "pale"},
    "disability": {"consciousness_level": 2},
    "expose": {"temperature_mouth": 37.2},
    "pre_contact_medications": [],
}

MOCK_RESPONSE = '''{
    "immediate_actions": "1. Administer oxygen 2. Monitor vitals",
    "monitoring_parameters": "SpO2 every 5 minutes, pulse every 5 minutes",
    "escalation_criteria": "If SpO2 drops below 90% request MEDEVAC",
    "next_report_in_minutes": 30,
    "full_response_text": "Secure airway and monitor patient closely. Report back in 30 minutes."
}'''

def test_run_response_returns_dict():
    with patch("services.response_chain.response_chain") as mock_chain:
        mock_chain.invoke.return_value = MOCK_RESPONSE
        result = run_response(SAMPLE_RECORD, "test-session-001")
        assert isinstance(result, dict)

def test_run_response_has_required_fields():
    with patch("services.response_chain.response_chain") as mock_chain:
        mock_chain.invoke.return_value = MOCK_RESPONSE
        result = run_response(SAMPLE_RECORD, "test-session-002")
        assert "immediate_actions" in result
        assert "monitoring_parameters" in result
        assert "escalation_criteria" in result
        assert "next_report_in_minutes" in result
        assert "full_response_text" in result

def test_run_response_next_report_is_int():
    with patch("services.response_chain.response_chain") as mock_chain:
        mock_chain.invoke.return_value = MOCK_RESPONSE
        result = run_response(SAMPLE_RECORD, "test-session-003")
        assert isinstance(result["next_report_in_minutes"], int)

def test_run_response_fields_are_strings():
    with patch("services.response_chain.response_chain") as mock_chain:
        mock_chain.invoke.return_value = MOCK_RESPONSE
        result = run_response(SAMPLE_RECORD, "test-session-004")
        assert isinstance(result["immediate_actions"], str)
        assert isinstance(result["full_response_text"], str)