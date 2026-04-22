from pydantic import BaseModel
from typing import Optional, Literal


class PatientInfo(BaseModel):
    name: Optional[str] = None
    birthdate: Optional[str] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    shipping_company: Optional[str] = None
    ship_name: Optional[str] = None
    coordinates: Optional[str] = None
    destination_eta: Optional[str] = None
    nearest_port_eta: Optional[str] = None
    medicine_chest: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None


class SectionAirway(BaseModel):
    clear_airways: Optional[bool] = None
    jaw_lift: Optional[bool] = None
    suction_applied: Optional[bool] = None
    guedel_airway: Optional[bool] = None
    cpr_initiated: Optional[str] = None
    oxygen_lmin: Optional[float] = None
    oxygen_device: Optional[Literal["nasal_cannula", "hudson_mask"]] = None
    neck_back_injury_suspected: Optional[bool] = None


class SectionBreathing(BaseModel):
    breathing_description: Optional[Literal["fast", "slow", "shallow", "deep", "normal"]] = None
    breaths_per_min: Optional[int] = None
    oxygen_saturation_pct: Optional[float] = None


class SectionCirculation(BaseModel):
    capillary_response_sec: Optional[float] = None
    venous_cannula: Optional[bool] = None
    skin_color: Optional[Literal["pale", "reddish", "bluish", "normal"]] = None
    skin_temperature_description: Optional[str] = None
    pulse_per_min: Optional[int] = None
    pulse_location: Optional[Literal["wrist", "neck", "groin"]] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None


class SectionDisability(BaseModel):
    consciousness_level: Optional[Literal[1, 2, 3, 4]] = None
    convulsions: Optional[bool] = None
    paralysis: Optional[bool] = None
    pupil_reaction_normal: Optional[bool] = None
    pupil_description: Optional[str] = None


class SectionExpose(BaseModel):
    top_to_toe_performed: Optional[bool] = None
    injury_illness_found: Optional[bool] = None
    injury_description: Optional[str] = None
    hypothermia_overheating: Optional[bool] = None
    temperature_mouth: Optional[float] = None
    temperature_alternative: Optional[float] = None


class RadioMedicalRecord(BaseModel):
    session_id: Optional[str] = None
    patient_info: Optional[PatientInfo] = None
    problem_description: str
    airway: Optional[SectionAirway] = None
    breathing: Optional[SectionBreathing] = None
    circulation: Optional[SectionCirculation] = None
    disability: Optional[SectionDisability] = None
    expose: Optional[SectionExpose] = None
    pre_contact_medications: Optional[list[str]] = []
    performed_actions: Optional[str] = None


class Deficiency(BaseModel):
    section: str
    field: Optional[str] = None
    severity: Literal["CRITICAL", "WARNING", "INFO"]
    description: str
    recommendation: str


class ReviewResponse(BaseModel):
    session_id: str
    deficiencies: list[Deficiency]
    overall_assessment: str
    completeness_score: float
    clinical_safety_score: float
    rag_sources: list[str] = []


class TrainingResponse(BaseModel):
    session_id: str
    immediate_actions: str
    monitoring_parameters: str
    escalation_criteria: str
    next_report_in_minutes: int
    full_response_text: str
    scenario_adapted: bool = False