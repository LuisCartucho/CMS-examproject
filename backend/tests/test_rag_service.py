import pytest
import os
from services.rag_service import get_rag_store, retrieve_guidelines

def test_rag_store_exists():
    store = get_rag_store()
    assert store is not None

def test_retrieve_returns_string():
    result = retrieve_guidelines("chest pain breathing difficulty")
    assert isinstance(result, str)
    assert len(result) > 0

def test_retrieve_relevant_content():
    result = retrieve_guidelines("oxygen saturation SpO2 breathing")
    assert any(word in result.lower() for word in ["oxygen", "breathing", "saturation", "spo2"])

def test_retrieve_circulation_guidelines():
    result = retrieve_guidelines("pulse heart rate blood pressure circulation")
    assert any(word in result.lower() for word in ["pulse", "heart", "blood pressure", "circulation"])

def test_retrieve_with_k_parameter():
    store = get_rag_store()
    docs = store.similarity_search("airway management", k=2)
    assert len(docs) <= 2