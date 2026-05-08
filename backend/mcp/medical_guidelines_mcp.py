from services.rag_service import retrieve_guidelines, get_rag_store

class MedicalGuidelinesMCP:
    """
    MCP Tool: Retrieves relevant maritime medical guidelines
    using RAG (ChromaDB vector search) based on a clinical query.
    """

    def __init__(self):
        self.name = "medical_guidelines_mcp"
        self.description = "Retrieve relevant maritime medical guidelines for a clinical query"

    def retrieve(self, query: str, k: int = 3) -> dict:
        """
        Retrieve relevant guideline chunks for a given clinical query.
        """
        try:
            store = get_rag_store()
            docs = store.similarity_search(query, k=k)
            results = [
                {
                    "content": doc.page_content,
                    "source": doc.metadata.get("source", "unknown"),
                }
                for doc in docs
            ]
            return {
                "success": True,
                "query": query,
                "results": results,
                "count": len(results)
            }
        except Exception as e:
            return {"success": False, "error": str(e), "results": []}

    def get_context_string(self, query: str, k: int = 3) -> str:
        """
        Returns guidelines as a single formatted string for LLM context.
        """
        result = self.retrieve(query, k)
        if not result["success"] or not result["results"]:
            return "No specific guidelines found. Use standard ABCDE maritime medical protocols."
        return "\n\n".join([r["content"] for r in result["results"]])


medical_guidelines_mcp = MedicalGuidelinesMCP()