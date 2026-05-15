from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from models.schemas import RadioMedicalRecord, ReviewResponse
from models.database import get_db, SessionRecord
from services.review_chain import run_review
import uuid, json

router = APIRouter()

@router.post("/review", response_model=ReviewResponse)
def review(record: RadioMedicalRecord, db: DBSession = Depends(get_db)):
    session_id = record.session_id or str(uuid.uuid4())
    result = run_review(record.model_dump(), session_id)

    # Save review to session
    session = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if session:
        session.review_data = json.dumps(result)
        db.commit()

    return ReviewResponse(
        session_id=session_id,
        deficiencies=result.get("deficiencies", []),
        overall_assessment=result.get("overall_assessment", ""),
        completeness_score=result.get("completeness_score", 0.0),
        clinical_safety_score=result.get("clinical_safety_score", 0.0),
        rag_sources=[]
    )