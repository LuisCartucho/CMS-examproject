import os
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader

CHROMA_DIR = "./chroma_db"
RAG_DATA_DIR = "./rag_data"

embeddings = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")

def build_rag_store():
    docs = []
    for filename in os.listdir(RAG_DATA_DIR):
        if filename.endswith(".txt"):
            loader = TextLoader(os.path.join(RAG_DATA_DIR, filename), encoding="utf-8")
            docs.extend(loader.load())

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
    )
    chunks = splitter.split_documents(docs)

    store = Chroma.from_documents(
        chunks,
        embeddings,
        persist_directory=CHROMA_DIR,
        collection_name="medical_guidelines"
    )
    print(f"RAG store built with {len(chunks)} chunks")
    return store

def get_rag_store():
    if os.path.exists(CHROMA_DIR):
        return Chroma(
            persist_directory=CHROMA_DIR,
            embedding_function=embeddings,
            collection_name="medical_guidelines"
        )
    return build_rag_store()

def retrieve_guidelines(query: str, k: int = 3) -> str:
    store = get_rag_store()
    docs = store.similarity_search(query, k=k)
    return "\n\n".join([d.page_content for d in docs])