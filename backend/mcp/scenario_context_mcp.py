from datetime import datetime

# Predefined training scenarios
SCENARIOS = {
    "trauma": {
        "name": "Maritime Trauma",
        "description": "Physical injury from fall, crush, or impact",
        "sea_state": "moderate",
        "hours_to_nearest_port": 12,
        "medevac_available": True,
        "on_board_resources": ["first_aid_kit", "oxygen", "stretcher", "AED"],
        "difficulty": "Intermediate",
        "key_considerations": [
            "Spinal immobilization if mechanism suggests",
            "Internal bleeding risk",
            "Pain management within medicine chest",
        ]
    },
    "cardiac": {
        "name": "Cardiac Emergency",
        "description": "Chest pain, suspected cardiac event",
        "sea_state": "calm",
        "hours_to_nearest_port": 6,
        "medevac_available": True,
        "on_board_resources": ["first_aid_kit", "oxygen", "AED", "aspirin"],
        "difficulty": "Advanced",
        "key_considerations": [
            "12-lead ECG if available",
            "Aspirin 300mg if no contraindications",
            "Rest and reassurance",
        ]
    },
    "hypothermia": {
        "name": "Cold Water Immersion",
        "description": "Hypothermia from cold water exposure",
        "sea_state": "rough",
        "hours_to_nearest_port": 18,
        "medevac_available": False,
        "on_board_resources": ["first_aid_kit", "blankets", "warm_fluids"],
        "difficulty": "Advanced",
        "key_considerations": [
            "Gentle handling - risk of cardiac arrhythmia",
            "Gradual rewarming",
            "Remove wet clothing immediately",
        ]
    },
    "respiratory": {
        "name": "Respiratory Distress",
        "description": "Breathing difficulty, possible pneumothorax or asthma",
        "sea_state": "moderate",
        "hours_to_nearest_port": 8,
        "medevac_available": True,
        "on_board_resources": ["first_aid_kit", "oxygen", "nebulizer"],
        "difficulty": "Intermediate",
        "key_considerations": [
            "Position upright if conscious",
            "High flow oxygen",
            "Monitor SpO2 continuously",
        ]
    },
    "default": {
        "name": "General Maritime Medical",
        "description": "General medical emergency at sea",
        "sea_state": "moderate",
        "hours_to_nearest_port": 10,
        "medevac_available": True,
        "on_board_resources": ["first_aid_kit", "oxygen", "basic_medications"],
        "difficulty": "Intermediate",
        "key_considerations": [
            "Follow ABCDE assessment",
            "Contact Radio Medical early",
            "Document all findings",
        ]
    }
}

def detect_scenario(problem_description: str) -> str:
    """Auto-detect scenario type from problem description."""
    text = problem_description.lower()
    if any(w in text for w in ["fell", "fall", "ladder", "crush", "trauma", "injury", "hit"]):
        return "trauma"
    if any(w in text for w in ["chest pain", "cardiac", "heart", "ecg"]):
        return "cardiac"
    if any(w in text for w in ["cold", "hypothermia", "water", "overboard", "immersion"]):
        return "hypothermia"
    if any(w in text for w in ["breathing", "breath", "respiratory", "asthma", "pneumo"]):
        return "respiratory"
    return "default"


class ScenarioContextMCP:
    """
    MCP Tool: Provides training scenario context to the LLM.
    Auto-detects scenario type from problem description.
    """

    def __init__(self):
        self.name = "scenario_context_mcp"
        self.description = "Provide training scenario context including resources and constraints"

    def get_scenario(self, problem_description: str) -> dict:
        """
        Get scenario context based on problem description.
        """
        scenario_key = detect_scenario(problem_description)
        scenario = SCENARIOS[scenario_key].copy()
        scenario["detected_type"] = scenario_key
        scenario["timestamp"] = datetime.utcnow().isoformat()
        return {"success": True, "scenario": scenario}

    def get_context_string(self, problem_description: str) -> str:
        """
        Returns scenario context as formatted string for LLM.
        """
        result = self.get_scenario(problem_description)
        if not result["success"]:
            return "Scenario context unavailable."
        s = result["scenario"]
        return (
            f"Scenario: {s['name']}\n"
            f"Sea state: {s['sea_state']}\n"
            f"Hours to nearest port: {s['hours_to_nearest_port']}\n"
            f"MEDEVAC available: {s['medevac_available']}\n"
            f"On-board resources: {', '.join(s['on_board_resources'])}\n"
            f"Key considerations: {'; '.join(s['key_considerations'])}"
        )


scenario_context_mcp = ScenarioContextMCP()