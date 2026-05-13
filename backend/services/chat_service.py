import json
from langchain_ollama import OllamaLLM
from langchain.prompts import PromptTemplate
from mcp.medical_guidelines_mcp import medical_guidelines_mcp
from mcp.session_memory_mcp import session_memory_mcp
from mcp.scenario_context_mcp import scenario_context_mcp

llm = OllamaLLM(model="mistral:7b", temperature=0.3)

CHAT_SYSTEM = """You are Radio Medical Denmark, the Danish telemedicine medical advice service for ships at sea.
You are responding to a medical officer on board a vessel who is treating a patient.

AVAILABLE MEDICINES ON BOARD (reference by number):
{guidelines}

PREVIOUS CONVERSATION:
{history}

SCENARIO CONTEXT:
{scenario}

You must respond as a real Radio Medical doctor would — professional, clear, and actionable.

RULES:
- Always sign off with "Best regards, Radio Medical Denmark"
- Reference medicines by their number (e.g. "3.1 Paracetamol 1g")
- Ask specific follow-up questions when you need more information
- Give clear numbered instructions when action is needed
- Assess if the case should be: ongoing, recovering, critical, or closed
- A case is CLOSED when: patient has recovered, been transferred to hospital, or no further advice is possible
- A case is CRITICAL when: MEDEVAC or immediate evacuation is needed
- A case is RECOVERING when: patient is improving and just needs monitoring
- A case is ONGOING when: treatment is in progress and regular check-ins are needed

OUTPUT FORMAT - respond ONLY with valid JSON:
{{
  "reply": "Your full Radio Medical response here, ending with Best regards, Radio Medical Denmark",
  "case_status": "ongoing or recovering or critical or closed",
  "next_check_minutes": 30
}}"""

CHAT_USER = """Medical officer update:
{message}

Patient context: {record_summary}

Respond as Radio Medical Denmark and assess the current case status."""

prompt = PromptTemplate(
    input_variables=["guidelines", "history", "scenario", "message", "record_summary"],
    template=CHAT_SYSTEM + "\n\n" + CHAT_USER
)

chat_chain = prompt | llm

def run_chat(session_id: str, message: str, record_summary: str = "") -> dict:
    guidelines = medical_guidelines_mcp.get_context_string(message)
    history = session_memory_mcp.get_context_string(session_id)
    scenario = scenario_context_mcp.get_context_string(message)

    result = chat_chain.invoke({
        "guidelines": guidelines,
        "history": history,
        "scenario": scenario,
        "message": message,
        "record_summary": record_summary or "See previous conversation history",
    })

    cleaned = result.strip()
    if "```" in cleaned:
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]

    try:
        parsed = json.loads(cleaned)
    except:
        parsed = {
            "reply": cleaned,
            "case_status": "ongoing",
            "next_check_minutes": 30
        }

    if not isinstance(parsed.get("next_check_minutes"), int):
        parsed["next_check_minutes"] = 30

    session_memory_mcp.save_exchange(
        session_id,
        f"Medical officer: {message}",
        parsed.get("reply", "")
    )

    return parsed