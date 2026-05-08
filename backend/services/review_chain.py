import json
from langchain_ollama import OllamaLLM
from langchain.prompts import PromptTemplate
from services.memory_service import memory_service
from mcp.medical_guidelines_mcp import medical_guidelines_mcp
from mcp.session_memory_mcp import session_memory_mcp
from mcp.scenario_context_mcp import scenario_context_mcp

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
    problem = record.get("problem_description", "")

    # MCP calls
    guidelines = medical_guidelines_mcp.get_context_string(problem)
    history    = session_memory_mcp.get_context_string(session_id)
    scenario   = scenario_context_mcp.get_context_string(problem)

    # Combine guidelines with scenario context
    full_context = f"{guidelines}\n\nSCENARIO CONTEXT:\n{scenario}"

    result = review_chain.invoke({
        "guidelines": full_context,
        "history": history,
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

    session_memory_mcp.save_exchange(
        session_id,
        f"Report: {problem}",
        parsed.get("overall_assessment", "")
    )

    return parsed