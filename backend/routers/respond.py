from fastapi import APIRouter
from models.schemas import RadioMedicalRecord, TrainingResponse
from services.response_chain import run_response
import uuid

router = APIRouter()

@router.post("/respond", response_model=TrainingResponse)
def respond(record: RadioMedicalRecord):
    session_id = record.session_id or str(uuid.uuid4())
    result = run_response(record.model_dump(), session_id)

    return TrainingResponse(
        session_id=session_id,
        immediate_actions=result.get("immediate_actions", ""),
        monitoring_parameters=result.get("monitoring_parameters", ""),
        escalation_criteria=result.get("escalation_criteria", ""),
        next_report_in_minutes=result.get("next_report_in_minutes", 30),
        full_response_text=result.get("full_response_text", ""),
        scenario_adapted=True
    )