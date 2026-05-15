from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.database import get_db, SessionRecord
from models.schemas import *
import uuid

router = APIRouter()

@router.post("/session/new")
def new_session(db: Session = Depends(get_db)):
    session_id = str(uuid.uuid4())
    record = SessionRecord(id=session_id, status="ongoing")
    db.add(record)
    db.commit()
    return {"session_id": session_id, "status": "ongoing"}

@router.get("/session/{session_id}")
def get_session(session_id: str, db: Session = Depends(get_db)):
    record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if not record:
        return {"error": "Session not found"}
    return {
        "session_id": record.id,
        "created_at": record.created_at,
        "status": record.status,
        "patient_name": record.patient_name,
        "problem_summary": record.problem_summary
    }

@router.patch("/session/{session_id}/status")
def update_status(session_id: str, status: str, db: Session = Depends(get_db)):
    record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if not record:
        return {"error": "Session not found"}
    record.status = status
    db.commit()
    return {"session_id": session_id, "status": status}

@router.patch("/session/{session_id}/patient")
def update_patient(
    session_id: str,
    patient_name: str = "",
    problem_summary: str = "",
    db: Session = Depends(get_db)
):
    record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    if not record:
        return {"error": "Session not found"}
    record.patient_name = patient_name
    record.problem_summary = problem_summary
    db.commit()
    return {"session_id": session_id, "patient_name": patient_name}

@router.delete("/session/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    db.query(SessionRecord).filter(SessionRecord.id == session_id).delete()
    db.commit()
    return {"deleted": session_id}