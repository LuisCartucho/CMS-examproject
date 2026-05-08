from services.memory_service import memory_service

class SessionMemoryMCP:
    """
    MCP Tool: Manages conversation memory per training session.
    Wraps LangChain ConversationBufferWindowMemory.
    """

    def __init__(self):
        self.name = "session_memory_mcp"
        self.description = "Store and retrieve conversation history for a training session"

    def get_history(self, session_id: str) -> dict:
        """
        Retrieve conversation history for a session.
        """
        try:
            history = memory_service.get_history(session_id)
            return {
                "success": True,
                "session_id": session_id,
                "history": history if history else "",
                "has_history": bool(history)
            }
        except Exception as e:
            return {"success": False, "error": str(e), "history": ""}

    def save_exchange(self, session_id: str, human_input: str, ai_output: str) -> dict:
        """
        Save a new exchange to session memory.
        """
        try:
            memory_service.save(session_id, human_input, ai_output)
            return {"success": True, "session_id": session_id}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_context_string(self, session_id: str) -> str:
        """
        Returns history as a string for LLM context.
        """
        result = self.get_history(session_id)
        if not result["success"] or not result["has_history"]:
            return "No previous exchanges in this session."
        return result["history"]


session_memory_mcp = SessionMemoryMCP()