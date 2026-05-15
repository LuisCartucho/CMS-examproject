from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from models.schemas import RadioMedicalRecord, TrainingResponse
from models.database import get_db, MessageRecord, SessionRecord
from services.response_chain import run_response
import uuid, json

router = APIRouter()

@router.post("/respond", response_model=TrainingResponse)
def respond(record: RadioMedicalRecord, db: DBSession = Depends(get_db)):
    session_id = record.session_id or str(uuid.uuid4())
    result = run_response(record.model_dump(), session_id)

    def to_str(val):
        if isinstance(val, list): return "\n".join(str(i) for i in val)
        if isinstance(val, dict): return "\n".join(f"{k}: {v}" for k, v in val.items())
        return str(val) if val is not None else ""

    # Save initial Radio Medical response as first message
    db.add(MessageRecord(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="assistant",
        content=to_str(result.get("full_response_text", ""))
    ))
    db.commit()

    return TrainingResponse(
        session_id=session_id,
        immediate_actions=to_str(result.get("immediate_actions", "")),
        monitoring_parameters=to_str(result.get("monitoring_parameters", "")),
        escalation_criteria=to_str(result.get("escalation_criteria", "")),
        next_report_in_minutes=result.get("next_report_in_minutes", 30),
        full_response_text=to_str(result.get("full_response_text", "")),
        scenario_adapted=True
    )