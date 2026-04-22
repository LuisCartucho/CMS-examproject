@mcp_tool(name="get_session_history")
def get_session_history(session_id: str) -> str:
    """Retrieve conversation history for a session to enable multi-turn context."""
    memory = memory_store.get(session_id)
    if not memory:
        return ""
    return memory.load_memory_variables({}).get("history", "")

@mcp_tool(name="save_to_memory")
def save_to_memory(session_id: str, human_input: str, ai_output: str) -> bool:
    """Save a new exchange to session memory."""
    memory = memory_store.setdefault(session_id, ConversationBufferWindowMemory(k=10))
    memory.save_context({"input": human_input}, {"output": ai_output})
    return True