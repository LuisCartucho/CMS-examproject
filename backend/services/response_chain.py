import json
from langchain_ollama import OllamaLLM
from langchain.prompts import PromptTemplate
from services.memory_service import memory_service

llm = OllamaLLM(model="mistral:7b", temperature=0.3)

response_system = open("prompts/response_system.txt").read()
response_user = open("prompts/response_user.txt").read()

full_prompt = response_system + "\n\n" + response_user

prompt = PromptTemplate(
    input_variables=[
        "guidelines", "history", "deficiencies",
        "problem_description", "airway", "breathing",
        "circulation", "disability", "expose", "medications"
    ],
    template=full_prompt
)

response_chain = prompt | llm

def run_response(record: dict, session_id: str, deficiencies: list = None) -> dict:
    history = memory_service.get_history(session_id)

    result = response_chain.invoke({
        "guidelines": "Use standard ABCDE maritime medical assessment guidelines.",
        "history": history if history else "No previous exchanges.",
        "deficiencies": json.dumps(deficiencies or []),
        "problem_description": record.get("problem_description", ""),
        "airway": json.dumps(record.get("airway", {})),
        "breathing": json.dumps(record.get("breathing", {})),
        "circulation": json.dumps(record.get("circulation", {})),
        "disability": json.dumps(record.get("disability", {})),
        "expose": json.dumps(record.get("expose", {})),
        "medications": json.dumps(record.get("pre_contact_medications", [])),
    })

    cleaned = result.strip()
    if "```" in cleaned:
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]

    parsed = json.loads(cleaned)

    # Normalize fields to strings in case LLM returns list or dict
    def to_str(val):
        if isinstance(val, list):
            return "\n".join(str(i) for i in val)
        if isinstance(val, dict):
            return "\n".join(f"{k}: {v}" for k, v in val.items())
        return str(val) if val is not None else ""

    parsed["immediate_actions"] = to_str(parsed.get("immediate_actions", ""))
    parsed["monitoring_parameters"] = to_str(parsed.get("monitoring_parameters", ""))
    parsed["escalation_criteria"] = to_str(parsed.get("escalation_criteria", ""))
    parsed["full_response_text"] = to_str(parsed.get("full_response_text", ""))

    if not isinstance(parsed.get("next_report_in_minutes"), int):
        parsed["next_report_in_minutes"] = 30

    memory_service.save(
        session_id,
        f"Response requested: {record.get('problem_description', '')}",
        parsed.get("full_response_text", "")
    )

    return parsed