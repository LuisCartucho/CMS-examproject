from fastapi import APIRouter
from models.schemas import ChatRequest, ChatResponse
from services.chat_service import run_chat

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    result = run_chat(
        session_id=request.session_id,
        message=request.message,
        record_summary=request.record_summary or ""
    )

    return ChatResponse(
        session_id=request.session_id,
        reply=result.get("reply", ""),
        case_status=result.get("case_status", "ongoing"),
        next_check_minutes=result.get("next_check_minutes", 30)
    )