import json
from langchain_ollama import OllamaLLM
from langchain.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from services.memory_service import memory_service

llm = OllamaLLM(model="mistral:7b", temperature=0.2)

review_system = open("prompts/review_system.txt").read()
review_user = open("prompts/review_user.txt").read()

full_prompt = review_system + "\n\n" + review_user

prompt = PromptTemplate(
    input_variables=[
        "guidelines", "history", "problem_description",
        "airway", "breathing", "circulation",
        "disability", "expose", "medications"
    ],
    template=full_prompt
)

review_chain = prompt | llm

def run_review(record: dict, session_id: str) -> dict:
    history = memory_service.get_history(session_id)

    result = review_chain.invoke({
        "guidelines": "Use standard ABCDE maritime medical assessment guidelines.",
        "history": history if history else "No previous exchanges.",
        "problem_description": record.get("problem_description", ""),
        "airway": json.dumps(record.get("airway", {})),
        "breathing": json.dumps(record.get("breathing", {})),
        "circulation": json.dumps(record.get("circulation", {})),
        "disability": json.dumps(record.get("disability", {})),
        "expose": json.dumps(record.get("expose", {})),
        "medications": json.dumps(record.get("pre_contact_medications", [])),
    })

    # Clean response and parse JSON
    cleaned = result.strip()
    if "```" in cleaned:
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]

    parsed = json.loads(cleaned)

    # Save to memory
    memory_service.save(
        session_id,
        f"Report submitted: {record.get('problem_description', '')}",
        parsed.get("overall_assessment", "")
    )

    return parsed