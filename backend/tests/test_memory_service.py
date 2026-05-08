import pytest
from services.memory_service import MemoryService

def test_create_new_session():
    service = MemoryService()
    mem = service.get_or_create("session-001")
    assert mem is not None

def test_get_history_empty():
    service = MemoryService()
    history = service.get_history("session-new")
    assert history == ""

def test_save_and_retrieve():
    service = MemoryService()
    service.save("session-002", "Patient has chest pain", "Administer oxygen immediately")
    history = service.get_history("session-002")
    assert "chest pain" in history or "oxygen" in history

def test_multiple_sessions_isolated():
    service = MemoryService()
    service.save("session-A", "Report A", "Response A")
    service.save("session-B", "Report B", "Response B")
    history_a = service.get_history("session-A")
    history_b = service.get_history("session-B")
    assert history_a != history_b

def test_window_memory_created():
    service = MemoryService()
    mem = service.get_or_create("session-003")
    assert hasattr(mem, 'save_context')