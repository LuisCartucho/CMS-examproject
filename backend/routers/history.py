from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.database import get_db, SessionRecord

router = APIRouter()

@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    sessions = db.query(SessionRecord).order_by(SessionRecord.created_at.desc()).all()
    return [{"session_id": s.id, "created_at": s.created_at} for s in sessions]