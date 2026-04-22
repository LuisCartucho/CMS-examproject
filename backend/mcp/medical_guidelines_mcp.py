@mcp_tool(name="retrieve_medical_guidelines")
def retrieve_guidelines(query: str, top_k: int = 3) -> list[dict]:
    """Retrieve relevant maritime medical guidelines for a given clinical query."""
    results = chroma_collection.query(query_texts=[query], n_results=top_k)
    return [{"text": doc, "source": meta["source"]}
            for doc, meta in zip(results["documents"][0], results["metadatas"][0])]