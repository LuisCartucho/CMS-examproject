import json
from langchain_ollama import OllamaLLM
from langchain.prompts import PromptTemplate
from mcp.medical_guidelines_mcp import medical_guidelines_mcp
from mcp.session_memory_mcp import session_memory_mcp
from mcp.scenario_context_mcp import scenario_context_mcp

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
    problem = record.get("problem_description", "")

    # MCP calls
    guidelines = medical_guidelines_mcp.get_context_string(problem)
    history    = session_memory_mcp.get_context_string(session_id)
    scenario   = scenario_context_mcp.get_context_string(problem)

    full_context = f"{guidelines}\n\nSCENARIO CONTEXT:\n{scenario}"

    result = response_chain.invoke({
        "guidelines": full_context,
        "history": history,
        "deficiencies": json.dumps(deficiencies or []),
        "problem_description": problem,
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

    def to_str(val):
        if isinstance(val, list):
            return "\n".join(str(i) for i in val)
        if isinstance(val, dict):
            return "\n".join(f"{k}: {v}" for k, v in val.items())
        return str(val) if val is not None else ""

    parsed["immediate_actions"]    = to_str(parsed.get("immediate_actions", ""))
    parsed["monitoring_parameters"] = to_str(parsed.get("monitoring_parameters", ""))
    parsed["escalation_criteria"]  = to_str(parsed.get("escalation_criteria", ""))
    parsed["full_response_text"]   = to_str(parsed.get("full_response_text", ""))

    if not isinstance(parsed.get("next_report_in_minutes"), int):
        parsed["next_report_in_minutes"] = 30

    session_memory_mcp.save_exchange(
        session_id,
        f"Response requested: {problem}",
        parsed.get("full_response_text", "")
    )

    return parsed