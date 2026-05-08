import { useState } from 'react'
import { newSession, reviewReport, generateResponse } from './api/client'

// ── Types ──────────────────────────────────────────────────────────────────
interface Deficiency {
  section: string
  field?: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  description: string
  recommendation: string
}

interface ReviewResult {
  session_id: string
  deficiencies: Deficiency[]
  overall_assessment: string
  completeness_score: number
  clinical_safety_score: number
}

interface ResponseResult {
  session_id: string
  immediate_actions: string
  monitoring_parameters: string
  escalation_criteria: string
  next_report_in_minutes: number
  full_response_text: string
}

// ── Initial form state ─────────────────────────────────────────────────────
const initialForm = {
  problem_description: '',
  patient_info: { name: '', birthdate: '', gender: '', nationality: '', shipping_company: '', ship_name: '', ship_email: '', satellite_call: '', call_signal: '', coordinates: '', destination_eta: '', nearest_port_eta: '', medicine_chest: '' },
  airway: { clear_airways: null as boolean | null, jaw_lift: null as boolean | null, suction_applied: null as boolean | null, guedel_airway: null as boolean | null, cpr_initiated: '', oxygen_lmin: '', oxygen_device: '', neck_back_injury_suspected: null as boolean | null },
  breathing: { breathing_description: '', breaths_per_min: '', oxygen_saturation_pct: '' },
  circulation: { pulse_per_min: '', skin_color: '', capillary_response_sec: '', blood_pressure_systolic: '', blood_pressure_diastolic: '', venous_cannula: null as boolean | null, skin_temperature_description: '', pulse_location: '' },
  disability: { consciousness_level: '', convulsions: null as boolean | null, paralysis: null as boolean | null, pupil_reaction_normal: null as boolean | null, pupil_description: '' },
  expose: { top_to_toe_performed: null as boolean | null, injury_illness_found: null as boolean | null, injury_description: '', hypothermia_overheating: null as boolean | null, temperature_mouth: '' },
  pre_contact_medications: [] as string[],
  performed_actions: '',
}

// ── Helpers ────────────────────────────────────────────────────────────────
const cleanForm = (form: typeof initialForm) => {
  const clean = (obj: any): any => {
    if (obj === null || obj === undefined) return null
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => {
          if (v === '' || v === undefined) return [k, null]
          if (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== '') return [k, Number(v)]
          if (typeof v === 'object') return [k, clean(v)]
          return [k, v]
        })
      )
    }
    return obj
  }
  return clean(form)
}

const sectionComplete = (data: Record<string, any>) => {
  const values = Object.values(data)
  const filled = values.filter(v => v !== null && v !== '' && v !== undefined)
  return filled.length / values.length
}

// ── Section nav config ─────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'A', label: 'Airway',      color: '#ef4444', key: 'airway' },
  { id: 'B', label: 'Breathing',   color: '#3b82f6', key: 'breathing' },
  { id: 'C', label: 'Circulation', color: '#22c55e', key: 'circulation' },
  { id: 'D', label: 'Disability',  color: '#a855f7', key: 'disability' },
  { id: 'E', label: 'Expose',      color: '#f97316', key: 'expose' },
]

// ── YesNo Button ───────────────────────────────────────────────────────────
function YesNo({ value, onChange }: { value: boolean | null, onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[true, false].map(v => (
        <button key={String(v)} onClick={() => onChange(v)}
          className={`px-4 py-1.5 text-sm font-medium border rounded transition-all ${value === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
          {v ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  )
}

// ── Severity badge ─────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    CRITICAL:   'bg-red-100 text-red-700 border-red-200',
    WARNING:    'bg-yellow-100 text-yellow-700 border-yellow-200',
    INFO:       'bg-blue-100 text-blue-700 border-blue-200',
    SUGGESTION: 'bg-orange-100 text-orange-700 border-orange-200',
  }
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${styles[severity] || styles.INFO}`}>
      {severity}
    </span>
  )
}

// ── Progress ring ──────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 80 }: { pct: number, size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        className="rotate-90" style={{ transform: `rotate(90deg) translate(0, 0)`, fill: color, fontSize: 16, fontWeight: 700, transformOrigin: `${size/2}px ${size/2}px` }}>
        {pct}%
      </text>
    </svg>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [review, setReview] = useState<ReviewResult | null>(null)
  const [response, setResponse] = useState<ResponseResult | null>(null)
  const [loading, setLoading] = useState('')
  const [activeTab, setActiveTab] = useState<'form' | 'review' | 'response'>('form')
  const [activeSection, setActiveSection] = useState('A')
  const [medications, setMedications] = useState('')

  const startSession = async () => {
    const res = await newSession()
    setSessionId(res.data.session_id)
  }

  const handleReview = async () => {
    setLoading('review')
    try {
      const payload = { ...cleanForm(form), session_id: sessionId }
      const res = await reviewReport(payload)
      setReview(res.data)
      setActiveTab('review')
    } catch (e) { console.error(e) }
    finally { setLoading('') }
  }

  const handleRespond = async () => {
    setLoading('respond')
    try {
      const payload = { ...cleanForm(form), session_id: sessionId }
      const res = await generateResponse(payload)
      setResponse(res.data)
      setActiveTab('response')
    } catch (e) { console.error(e) }
    finally { setLoading('') }
  }

  const setField = (section: string | null, field: string, value: any) => {
    if (section) {
      setForm(f => ({ ...f, [section]: { ...(f as any)[section], [field]: value } }))
    } else {
      setForm(f => ({ ...f, [field]: value }))
    }
  }

  const completedSections = SECTIONS.filter(s => sectionComplete((form as any)[s.key]) > 0.4).length
  const overallPct = Math.round((completedSections / SECTIONS.length) * 100)

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }} className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold">M</div>
          <div>
            <div className="text-gray-900 font-bold text-sm leading-none">MedRadio-AI</div>
            <div className="text-gray-400 text-xs">Centre for Maritime Health Services</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {sessionId && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Session {sessionId.slice(0, 8)}
            </div>
          )}
          <button onClick={startSession}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            New Session
          </button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 max-w-6xl mx-auto">
          {([
            { id: 'form',     icon: '📋', label: 'Radio Medical Record' },
            { id: 'review',   icon: '🧠', label: 'AI Review' },
            { id: 'response', icon: '💬', label: 'Training Response' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* ══════════════════════════════════════════
            FORM TAB
        ══════════════════════════════════════════ */}
        {activeTab === 'form' && (
          <div className="space-y-6">

            {/* Patient Info card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-blue-600 text-lg">👤</span>
                <h2 className="font-bold text-gray-800">Patient Information</h2>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  ['NAME / TITLE', 'patient_info', 'name', 'Full name'],
                  ['BIRTHDATE / CPR', 'patient_info', 'birthdate', 'DD-MM-YYYY'],
                ].map(([label, sec, field, placeholder]) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
                    <input value={(form as any)[sec][field]} onChange={e => setField(sec, field, e.target.value)}
                      placeholder={placeholder}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">GENDER</label>
                  <div className="mt-1 flex gap-2">
                    {['Male', 'Female', 'Other'].map(g => (
                      <button key={g} onClick={() => setField('patient_info', 'gender', g.toLowerCase())}
                        className={`flex-1 py-2 text-sm font-medium border rounded-lg transition-all ${form.patient_info.gender === g.toLowerCase() ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  ['NATIONALITY', 'patient_info', 'nationality', 'Nationality'],
                  ['DATE', 'patient_info', 'date', 'mm/dd/yyyy'],
                  ['UTC', 'patient_info', 'utc', 'UTC time'],
                ].map(([label, sec, field, placeholder]) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
                    <input value={(form as any)[sec]?.[field] || ''} onChange={e => setField(sec, field, e.target.value)}
                      placeholder={placeholder} type={field === 'date' ? 'date' : 'text'}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400" />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-4 mt-2">
                <span className="text-blue-600">🚢</span>
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Ship Details</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ['SHIPPING COMPANY', 'patient_info', 'shipping_company', 'Company name'],
                  ['SHIP NAME', 'patient_info', 'ship_name', 'Vessel name'],
                  ['SHIP E-MAIL', 'patient_info', 'ship_email', 'ship@email.com'],
                  ['SATELLITE CALL NO.', 'patient_info', 'satellite_call', 'Sat phone number'],
                  ['CALL SIGNAL', 'patient_info', 'call_signal', 'Call signal'],
                  ['COORDINATES', 'patient_info', 'coordinates', 'Lat / Long'],
                ].map(([label, sec, field, placeholder]) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
                    <input value={(form as any)[sec][field] || ''} onChange={e => setField(sec, field, e.target.value)}
                      placeholder={placeholder}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400" />
                  </div>
                ))}
              </div>
            </div>

            {/* Problem Description */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-orange-500">⚠️</span>
                <h2 className="font-bold text-gray-800">Problem Description</h2>
              </div>
              <textarea value={form.problem_description} onChange={e => setField(null, 'problem_description', e.target.value)}
                rows={4} placeholder="Describe what happened, where it happened, when it happened, and what are the patient's symptoms..."
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-blue-400 resize-none" />

              <div className="grid grid-cols-2 gap-6 mt-5 pt-5 border-t border-gray-100">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Does the patient take any medicine?</label>
                  <div className="mt-2 flex gap-2">
                    <YesNo value={form.pre_contact_medications.length > 0 ? true : null} onChange={(v) => { if (!v) setForm(f => ({ ...f, pre_contact_medications: [] })) }} />
                  </div>
                  <input value={medications} onChange={e => setMedications(e.target.value)}
                    onBlur={() => { if (medications) setForm(f => ({ ...f, pre_contact_medications: medications.split(',').map(m => m.trim()) })) }}
                    placeholder="List medications (comma separated)"
                    className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Does the patient have any allergies?</label>
                  <div className="mt-2">
                    <input value={form.patient_info.nationality} onChange={e => setField('patient_info', 'allergies', e.target.value)}
                      placeholder="List allergies..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* ABCDE Assessment */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-purple-600">🔍</span>
                <h2 className="font-bold text-gray-800">ABCDE Assessment</h2>
              </div>

              <div className="flex gap-6">
                {/* Side nav */}
                <div className="w-48 flex-shrink-0 space-y-1">
                  {SECTIONS.map(s => {
                    const pct = sectionComplete((form as any)[s.key])
                    const done = pct > 0.4
                    const active = activeSection === s.id
                    return (
                      <button key={s.id} onClick={() => setActiveSection(s.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${active ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all`}
                          style={{ borderColor: done ? s.color : active ? s.color : '#d1d5db', backgroundColor: done ? s.color : 'transparent', color: done ? 'white' : active ? s.color : '#9ca3af' }}>
                          {done ? '✓' : s.id}
                        </div>
                        <span className={`text-sm font-medium ${active ? 'text-blue-700' : 'text-gray-600'}`}>{s.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Section content */}
                <div className="flex-1 border-l-4 pl-6" style={{ borderColor: SECTIONS.find(s => s.id === activeSection)?.color }}>

                  {/* A - Airway */}
                  {activeSection === 'A' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">A — Airway</h3>
                        <p className="text-gray-500 text-sm">Assess and manage the patient's airway</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CLEAR AIRWAYS</label>
                        <div className="mt-2"><YesNo value={form.airway.clear_airways} onChange={v => setField('airway', 'clear_airways', v)} /></div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">IF NO: ACTIONS TAKEN</label>
                        <div className="mt-2 flex gap-2 flex-wrap">
                          {[['jaw_lift', 'Jaw lift'], ['suction_applied', 'Suction applied'], ['guedel_airway', 'Guedel airway']].map(([field, label]) => (
                            <button key={field} onClick={() => setField('airway', field, !(form.airway as any)[field])}
                              className={`px-4 py-1.5 text-sm font-medium border rounded-lg transition-all ${(form.airway as any)[field] ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">OXYGEN L/MIN</label>
                          <input type="number" value={form.airway.oxygen_lmin} onChange={e => setField('airway', 'oxygen_lmin', e.target.value)}
                            placeholder="L/min"
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">OXYGEN DEVICE</label>
                          <select value={form.airway.oxygen_device} onChange={e => setField('airway', 'oxygen_device', e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white">
                            <option value="">Select device...</option>
                            <option value="nasal_cannula">Nasal Cannula (≤5 L/min)</option>
                            <option value="hudson_mask">Hudson Mask (&gt;10 L/min)</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">NECK / BACK SUSPICION OF INJURY</label>
                        <div className="mt-2"><YesNo value={form.airway.neck_back_injury_suspected} onChange={v => setField('airway', 'neck_back_injury_suspected', v)} /></div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CPR INITIATED AT</label>
                        <input type="time" value={form.airway.cpr_initiated} onChange={e => setField('airway', 'cpr_initiated', e.target.value)}
                          className="mt-1 w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                      </div>
                    </div>
                  )}

                  {/* B - Breathing */}
                  {activeSection === 'B' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">B — Breathing</h3>
                        <p className="text-gray-500 text-sm">Assess breathing frequency and depth</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">DESCRIPTION OF BREATHING</label>
                        <div className="mt-2 flex gap-2 flex-wrap">
                          {['fast', 'slow', 'shallow', 'deep', 'normal'].map(v => (
                            <button key={v} onClick={() => setField('breathing', 'breathing_description', v)}
                              className={`px-4 py-1.5 text-sm font-medium border rounded-lg capitalize transition-all ${form.breathing.breathing_description === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            BREATHS PER MIN <span className="text-gray-400 normal-case font-normal">(normal 12–16)</span>
                          </label>
                          <input type="number" value={form.breathing.breaths_per_min} onChange={e => setField('breathing', 'breaths_per_min', e.target.value)}
                            className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${form.breathing.breaths_per_min && (Number(form.breathing.breaths_per_min) < 12 || Number(form.breathing.breaths_per_min) > 16) ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-blue-400'}`} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            OXYGEN SATURATION % <span className="text-gray-400 normal-case font-normal">(normal 95–100)</span>
                          </label>
                          <input type="number" value={form.breathing.oxygen_saturation_pct} onChange={e => setField('breathing', 'oxygen_saturation_pct', e.target.value)}
                            className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${form.breathing.oxygen_saturation_pct && Number(form.breathing.oxygen_saturation_pct) < 95 ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-blue-400'}`} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* C - Circulation */}
                  {activeSection === 'C' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">C — Circulation</h3>
                        <p className="text-gray-500 text-sm">Assess circulatory status</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PULSE /MIN <span className="text-gray-400 normal-case font-normal">(60–80)</span></label>
                          <input type="number" value={form.circulation.pulse_per_min} onChange={e => setField('circulation', 'pulse_per_min', e.target.value)}
                            className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${form.circulation.pulse_per_min && (Number(form.circulation.pulse_per_min) < 60 || Number(form.circulation.pulse_per_min) > 80) ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-blue-400'}`} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">MEASURED AT</label>
                          <div className="mt-1 flex gap-2">
                            {['wrist', 'neck', 'groin'].map(loc => (
                              <button key={loc} onClick={() => setField('circulation', 'pulse_location', loc)}
                                className={`flex-1 py-2 text-sm font-medium border rounded-lg capitalize transition-all ${form.circulation.pulse_location === loc ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                                {loc}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">BP SYSTOLIC <span className="text-gray-400 normal-case font-normal">(120–140)</span></label>
                          <input type="number" value={form.circulation.blood_pressure_systolic} onChange={e => setField('circulation', 'blood_pressure_systolic', e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">BP DIASTOLIC <span className="text-gray-400 normal-case font-normal">(60–90)</span></label>
                          <input type="number" value={form.circulation.blood_pressure_diastolic} onChange={e => setField('circulation', 'blood_pressure_diastolic', e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CAPILLARY REFILL (SEC) <span className="text-gray-400 normal-case font-normal">(&lt;2)</span></label>
                          <input type="number" step="0.1" value={form.circulation.capillary_response_sec} onChange={e => setField('circulation', 'capillary_response_sec', e.target.value)}
                            className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${form.circulation.capillary_response_sec && Number(form.circulation.capillary_response_sec) > 2 ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-blue-400'}`} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SKIN COLOR</label>
                          <div className="mt-1 flex gap-2 flex-wrap">
                            {['pale', 'reddish', 'bluish', 'normal'].map(c => (
                              <button key={c} onClick={() => setField('circulation', 'skin_color', c)}
                                className={`px-3 py-1.5 text-sm font-medium border rounded-lg capitalize transition-all ${form.circulation.skin_color === c ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">VENOUS CANNULA INSERTED</label>
                        <div className="mt-2"><YesNo value={form.circulation.venous_cannula} onChange={v => setField('circulation', 'venous_cannula', v)} /></div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SKIN TEMPERATURE / HUMIDITY</label>
                        <input value={form.circulation.skin_temperature_description} onChange={e => setField('circulation', 'skin_temperature_description', e.target.value)}
                          placeholder="e.g. cold and clammy, warm and dry..."
                          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                      </div>
                    </div>
                  )}

                  {/* D - Disability */}
                  {activeSection === 'D' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">D — Disability</h3>
                        <p className="text-gray-500 text-sm">Assess level of consciousness and neurological status</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">LEVEL OF CONSCIOUSNESS</label>
                        <div className="mt-2 space-y-2">
                          {[
                            [1, 'Awake, alert and well orientated'],
                            [2, 'Unclear, but responds to questions'],
                            [3, 'Does not respond to questions but to pain stimuli'],
                            [4, 'Unconscious and unresponsive to pain stimuli'],
                          ].map(([val, label]) => (
                            <button key={val} onClick={() => setField('disability', 'consciousness_level', val)}
                              className={`w-full text-left px-4 py-3 text-sm border rounded-lg transition-all ${form.disability.consciousness_level == val ? 'bg-purple-50 border-purple-400 text-purple-800 font-medium' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}>
                              {val}. {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CONVULSIONS</label>
                          <div className="mt-2"><YesNo value={form.disability.convulsions} onChange={v => setField('disability', 'convulsions', v)} /></div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PARALYSIS</label>
                          <div className="mt-2"><YesNo value={form.disability.paralysis} onChange={v => setField('disability', 'paralysis', v)} /></div>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PUPIL REACTION</label>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => setField('disability', 'pupil_reaction_normal', true)}
                            className={`px-4 py-2 text-sm font-medium border rounded-lg transition-all ${form.disability.pupil_reaction_normal === true ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                            Normal (uniform contraction)
                          </button>
                          <button onClick={() => setField('disability', 'pupil_reaction_normal', false)}
                            className={`px-4 py-2 text-sm font-medium border rounded-lg transition-all ${form.disability.pupil_reaction_normal === false ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                            Abnormal - describe
                          </button>
                        </div>
                        {form.disability.pupil_reaction_normal === false && (
                          <input value={form.disability.pupil_description} onChange={e => setField('disability', 'pupil_description', e.target.value)}
                            placeholder="Describe pupil abnormality..."
                            className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* E - Expose */}
                  {activeSection === 'E' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">E — Expose</h3>
                        <p className="text-gray-500 text-sm">Full body examination</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">TOP TO TOE EXAMINATION PERFORMED</label>
                        <div className="mt-2"><YesNo value={form.expose.top_to_toe_performed} onChange={v => setField('expose', 'top_to_toe_performed', v)} /></div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SIGNS OF INJURY / ILLNESS</label>
                        <div className="mt-2"><YesNo value={form.expose.injury_illness_found} onChange={v => setField('expose', 'injury_illness_found', v)} /></div>
                        {form.expose.injury_illness_found && (
                          <input value={form.expose.injury_description} onChange={e => setField('expose', 'injury_description', e.target.value)}
                            placeholder="Describe findings..."
                            className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SIGNS OF HYPOTHERMIA OR OVERHEATING</label>
                        <div className="mt-2"><YesNo value={form.expose.hypothermia_overheating} onChange={v => setField('expose', 'hypothermia_overheating', v)} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">TEMPERATURE (MOUTH) °C <span className="text-gray-400 font-normal normal-case">(36.5)</span></label>
                          <input type="number" step="0.1" value={form.expose.temperature_mouth} onChange={e => setField('expose', 'temperature_mouth', e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PERFORMED ACTIONS</label>
                          <input value={form.performed_actions} onChange={e => setField(null, 'performed_actions', e.target.value)}
                            placeholder="Any actions taken before contact..."
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Next/Prev */}
                  <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
                    <button onClick={() => { const i = SECTIONS.findIndex(s => s.id === activeSection); if (i > 0) setActiveSection(SECTIONS[i-1].id) }}
                      disabled={activeSection === 'A'}
                      className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-40 transition-all">
                      ← Previous
                    </button>
                    <button onClick={() => { const i = SECTIONS.findIndex(s => s.id === activeSection); if (i < SECTIONS.length - 1) setActiveSection(SECTIONS[i+1].id) }}
                      disabled={activeSection === 'E'}
                      className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-40 transition-all">
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit buttons */}
            {!sessionId && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700 text-center">
                ⚠️ Click "New Session" in the header before submitting
              </div>
            )}
            <div className="flex gap-4">
              <button onClick={handleReview} disabled={!sessionId || !!loading}
                className="flex-1 bg-white hover:bg-gray-50 disabled:opacity-40 text-gray-700 font-semibold py-3 text-sm border border-gray-200 rounded-xl transition-all flex items-center justify-center gap-2">
                {loading === 'review' ? <><span className="animate-spin">⟳</span> Analysing...</> : <><span>🧠</span> Review Report</>}
              </button>
              <button onClick={handleRespond} disabled={!sessionId || !!loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 text-sm rounded-xl transition-all flex items-center justify-center gap-2">
                {loading === 'respond' ? <><span className="animate-spin">⟳</span> Generating...</> : <><span>📡</span> Get Radio Response</>}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            REVIEW TAB
        ══════════════════════════════════════════ */}
        {activeTab === 'review' && review && (
          <div className="space-y-4">
            {/* Header card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">🧠</div>
                <div>
                  <h2 className="font-bold text-gray-800">AI Review Results</h2>
                  <p className="text-gray-500 text-sm">Automated analysis of your Radio Medical Report</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{completedSections}/{SECTIONS.length}</div>
                  <div className="text-xs text-gray-500">Sections Complete</div>
                </div>
                <ProgressRing pct={Math.round(review.completeness_score * 100)} />
              </div>
            </div>

            {/* Split panel */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left: submitted report summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-4">Submitted Report</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Patient Info', val: `${form.patient_info.name || '—'}, ${form.patient_info.gender || '—'}`, done: !!form.patient_info.name },
                    { label: 'Problem Description', val: form.problem_description.slice(0, 60) + (form.problem_description.length > 60 ? '...' : ''), done: !!form.problem_description, warn: !form.problem_description },
                    { label: 'A - Airway', val: form.airway.clear_airways !== null ? `Clear: ${form.airway.clear_airways ? 'Yes' : 'No'}, O2: ${form.airway.oxygen_lmin || '—'} L/min` : 'Not assessed', done: form.airway.clear_airways !== null },
                    { label: 'B - Breathing', val: `${form.breathing.breathing_description || '—'}, ${form.breathing.breaths_per_min || '—'} breaths/min, SpO2 ${form.breathing.oxygen_saturation_pct || '—'}%`, done: !!form.breathing.breaths_per_min },
                    { label: 'C - Circulation', val: `Pulse ${form.circulation.pulse_per_min || '—'} bpm, BP ${form.circulation.blood_pressure_systolic || '—'}/${form.circulation.blood_pressure_diastolic || '—'}`, done: !!form.circulation.pulse_per_min, warn: !!form.circulation.pulse_per_min && (Number(form.circulation.pulse_per_min) < 60 || Number(form.circulation.pulse_per_min) > 80) },
                    { label: 'D - Disability', val: form.disability.consciousness_level ? `Level ${form.disability.consciousness_level}` : 'Not assessed', done: !!form.disability.consciousness_level },
                    { label: 'E - Expose', val: form.expose.temperature_mouth ? `Temp ${form.expose.temperature_mouth}°C` : 'Not fully assessed', done: !!form.expose.temperature_mouth },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs mt-0.5 ${item.warn ? 'bg-yellow-100 text-yellow-600' : item.done ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {item.warn ? '⚠' : item.done ? '✓' : '○'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700">{item.label}</div>
                        <div className="text-xs text-gray-500 truncate">{item.val}</div>
                      </div>
                      <span className="text-gray-300 text-xs">›</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: AI feedback */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-4">
                  AI Feedback & Recommendations
                </h3>
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-800">{review.overall_assessment}</p>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {review.deficiencies.map((d, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${d.severity === 'CRITICAL' ? 'bg-red-50 border-red-200' : d.severity === 'WARNING' ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={d.severity} />
                        <span className="text-xs text-gray-500">{d.section}{d.field ? ` - ${d.field}` : ''}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">{d.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{d.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                <ProgressRing pct={Math.round(review.completeness_score * 100)} size={64} />
                <div>
                  <div className="text-sm font-semibold text-gray-700">Completeness Score</div>
                  <div className="text-xs text-gray-500">How complete the report is</div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                <ProgressRing pct={Math.round(review.clinical_safety_score * 100)} size={64} />
                <div>
                  <div className="text-sm font-semibold text-gray-700">Clinical Safety Score</div>
                  <div className="text-xs text-gray-500">Patient safety assessment</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            RESPONSE TAB
        ══════════════════════════════════════════ */}
        {activeTab === 'response' && response && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-xl">💬</div>
                  <div>
                    <h2 className="font-bold text-gray-800">Training Response</h2>
                    <p className="text-gray-500 text-sm">AI-generated situation-adapted responses for training simulation</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">Scenario: Maritime</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">Difficulty: Intermediate</span>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Consistent Quality</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"></span>Awaiting Input</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>Needs Attention</span>
              </div>

              {/* Radio response */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm">📡</div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Initial Assessment Response</div>
                    <div className="text-xs text-gray-400">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC</div>
                  </div>
                  <div className="ml-auto">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Consistent
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{response.full_response_text}</p>
                <div className="mt-3 text-xs text-gray-500">
                  Next report in: <span className="font-semibold text-blue-600">{response.next_report_in_minutes} minutes</span>
                </div>
              </div>
            </div>

            {/* 3 columns */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { title: 'Immediate Actions', icon: '⚡', content: response.immediate_actions, color: 'blue' },
                { title: 'Monitoring Parameters', icon: '📊', content: response.monitoring_parameters, color: 'green' },
                { title: 'Escalation Criteria', icon: '🚨', content: response.escalation_criteria, color: 'red' },
              ].map(({ title, icon, content, color }) => (
                <div key={title} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className={`flex items-center gap-2 mb-3 text-${color}-600`}>
                    <span>{icon}</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider">{title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{content}</p>
                </div>
              ))}
            </div>

            {/* AI note */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <span className="text-amber-500 flex-shrink-0">⚠️</span>
              <p className="text-sm text-amber-800">
                <strong>AI Note:</strong> This response is generated for training simulation purposes only.
                Always follow official Radio Medical protocols in real emergencies.
              </p>
            </div>
          </div>
        )}

        {/* Empty states */}
        {activeTab === 'review' && !review && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🧠</div>
            <h3 className="font-bold text-gray-700 mb-1">No Review Yet</h3>
            <p className="text-gray-500 text-sm">Fill in the Radio Medical Record and click "Review Report"</p>
          </div>
        )}
        {activeTab === 'response' && !response && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📡</div>
            <h3 className="font-bold text-gray-700 mb-1">No Response Yet</h3>
            <p className="text-gray-500 text-sm">Fill in the Radio Medical Record and click "Get Radio Response"</p>
          </div>
        )}
      </div>
    </div>
  )
}
