from langchain.memory import ConversationBufferWindowMemory

class MemoryService:
    def __init__(self):
        self._store: dict[str, ConversationBufferWindowMemory] = {}

    def get_or_create(self, session_id: str) -> ConversationBufferWindowMemory:
        if session_id not in self._store:
            self._store[session_id] = ConversationBufferWindowMemory(
                k=10,
                memory_key="history",
                return_messages=False,
                human_prefix="Trainee Report",
                ai_prefix="Radio Medical"
            )
        return self._store[session_id]

    def save(self, session_id: str, report_summary: str, ai_response: str):
        mem = self.get_or_create(session_id)
        mem.save_context(
            {"input": report_summary},
            {"output": ai_response}
        )

    def get_history(self, session_id: str) -> str:
        if session_id not in self._store:
            return ""
        mem = self._store[session_id]
        return mem.load_memory_variables({}).get("history", "")

memory_service = MemoryService()