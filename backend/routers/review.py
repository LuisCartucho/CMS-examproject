from fastapi import APIRouter
from models.schemas import RadioMedicalRecord, ReviewResponse
from services.review_chain import run_review
import uuid

router = APIRouter()

@router.post("/review", response_model=ReviewResponse)
def review(record: RadioMedicalRecord):
    session_id = record.session_id or str(uuid.uuid4())
    result = run_review(record.model_dump(), session_id)

    return ReviewResponse(
        session_id=session_id,
        deficiencies=result.get("deficiencies", []),
        overall_assessment=result.get("overall_assessment", ""),
        completeness_score=result.get("completeness_score", 0.0),
        clinical_safety_score=result.get("clinical_safety_score", 0.0),
        rag_sources=[]
    )