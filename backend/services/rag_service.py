# backend/services/rag_service.py
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import SentenceTransformerEmbeddings

def build_rag_store(pdf_paths: list[str]) -> Chroma:
    docs = []
    for path in pdf_paths:
        loader = PyPDFLoader(path)
        docs.extend(loader.load())

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", ". "]
    )
    chunks = splitter.split_documents(docs)

    embeddings = SentenceTransformerEmbeddings(
        model_name="all-MiniLM-L6-v2"   # Offline-capable
    )

    return Chroma.from_documents(
        chunks,
        embeddings,
        persist_directory="./chroma_db",
        collection_name="medical_guidelines"
    )