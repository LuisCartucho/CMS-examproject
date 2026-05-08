import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_new_session():
    response = client.post("/api/session/new")
    assert response.status_code == 200
    assert "session_id" in response.json()

def test_get_session_not_found():
    response = client.get("/api/session/nonexistent-id")
    assert response.status_code == 200
    assert "error" in response.json()

def test_get_history():
    response = client.get("/api/history")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_review_missing_body():
    response = client.post("/api/review", json={})
    assert response.status_code == 422

def test_review_valid_body():
    with patch("routers.review.run_review") as mock_review:
        mock_review.return_value = {
            "deficiencies": [],
            "overall_assessment": "Patient stable.",
            "completeness_score": 0.8,
            "clinical_safety_score": 0.9
        }
        response = client.post("/api/review", json={
            "problem_description": "Test case",
            "session_id": None
        })
        assert response.status_code == 200