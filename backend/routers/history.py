from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.database import get_db, SessionRecord

router = APIRouter()

@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    sessions = db.query(SessionRecord).order_by(SessionRecord.created_at.desc()).all()
    return [
        {
            "session_id": s.id,
            "created_at": s.created_at,
            "status": s.status or "ongoing",
            "patient_name": s.patient_name or "Unknown Patient",
            "problem_summary": s.problem_summary or "No description"
        }
        for s in sessions
    ]

@router.get("/session/{session_id}/messages")
def get_messages(session_id: str, db: Session = Depends(get_db)):
    from models.database import MessageRecord
    msgs = db.query(MessageRecord).filter(
        MessageRecord.session_id == session_id
    ).order_by(MessageRecord.created_at).all()
    return [{"role": m.role, "content": m.content, "timestamp": m.created_at.strftime("%H:%M")} for m in msgs]

@router.get("/session/{session_id}/review")
def get_review(session_id: str, db: Session = Depends(get_db)):
    import json
    record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if not record or not record.review_data:
        return None
    return json.loads(record.review_data)