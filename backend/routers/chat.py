from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from models.database import get_db, MessageRecord
from models.schemas import ChatRequest, ChatResponse
from services.chat_service import run_chat
import uuid

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, db: DBSession = Depends(get_db)):
    # Save user message
    db.add(MessageRecord(
        id=str(uuid.uuid4()),
        session_id=request.session_id,
        role="user",
        content=request.message
    ))
    db.commit()

    result = run_chat(
        session_id=request.session_id,
        message=request.message,
        record_summary=request.record_summary or ""
    )

    # Save AI reply
    db.add(MessageRecord(
        id=str(uuid.uuid4()),
        session_id=request.session_id,
        role="assistant",
        content=result.get("reply", "")
    ))
    db.commit()

    return ChatResponse(
        session_id=request.session_id,
        reply=result.get("reply", ""),
        case_status=result.get("case_status", "ongoing"),
        next_check_minutes=result.get("next_check_minutes", 30)
    )