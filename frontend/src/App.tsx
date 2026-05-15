import { useState, useEffect, useRef } from 'react'
import { newSession, reviewReport, generateResponse } from './api/client'
import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000', timeout: 300000 })

// ── Types ──────────────────────────────────────────────────────────────────
type CaseStatus = 'ongoing' | 'recovering' | 'critical' | 'closed'
type Screen = 'dashboard' | 'form' | 'case'

interface Case {
  session_id: string
  patient_name: string
  problem_summary: string
  status: CaseStatus
  created_at: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
const statusConfig: Record<CaseStatus, { label: string; color: string; bg: string }> = {
  ongoing:   { label: 'Ongoing',    color: 'text-blue-700',  bg: 'bg-blue-100 border-blue-200' },
  recovering:{ label: 'Recovering', color: 'text-green-700', bg: 'bg-green-100 border-green-200' },
  critical:  { label: 'Critical',   color: 'text-red-700',   bg: 'bg-red-100 border-red-200' },
  closed:    { label: 'Closed',     color: 'text-gray-500',  bg: 'bg-gray-100 border-gray-200' },
}

const cleanForm = (form: any) => {
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

const initialForm = {
  problem_description: '',
  patient_info: { name: '', birthdate: '', gender: '', nationality: '', shipping_company: '', ship_name: '', ship_email: '', whatsapp: '', satellite_call: '', call_signal: '', coordinates: '', destination_eta: '', nearest_port_eta: '', medicine_chest: '' },
  airway: { clear_airways: null as boolean|null, jaw_lift: null as boolean|null, suction_applied: null as boolean|null, guedel_airway: null as boolean|null, cpr_initiated: '', oxygen_lmin: '', oxygen_device: '', neck_back_injury_suspected: null as boolean|null },
  breathing: { breathing_description: '', breaths_per_min: '', oxygen_saturation_pct: '' },
  circulation: { pulse_per_min: '', skin_color: '', capillary_response_sec: '', blood_pressure_systolic: '', blood_pressure_diastolic: '', venous_cannula: null as boolean|null, skin_temperature_description: '', pulse_location: '' },
  disability: { consciousness_level: '', convulsions: null as boolean|null, paralysis: null as boolean|null, pupil_reaction_normal: null as boolean|null, pupil_description: '' },
  expose: { top_to_toe_performed: null as boolean|null, injury_illness_found: null as boolean|null, injury_description: '', hypothermia_overheating: null as boolean|null, temperature_mouth: '', temperature_rectal: '' },
  pre_contact_medications: [] as string[],
  performed_actions: '',
}

const SECTIONS = [
  { id: 'A', label: 'Airway',      color: '#ef4444', key: 'airway' },
  { id: 'B', label: 'Breathing',   color: '#3b82f6', key: 'breathing' },
  { id: 'C', label: 'Circulation', color: '#22c55e', key: 'circulation' },
  { id: 'D', label: 'Disability',  color: '#a855f7', key: 'disability' },
  { id: 'E', label: 'Expose',      color: '#f97316', key: 'expose' },
]

function YesNo({ value, onChange }: { value: boolean|null, onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[true, false].map(v => (
        <button key={String(v)} onClick={() => onChange(v)}
          className={`px-4 py-1.5 text-sm font-medium border rounded-lg transition-all ${value === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
          {v ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [cases, setCases] = useState<Case[]>([])
  const [activeCase, setActiveCase] = useState<Case | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [form, setForm] = useState(initialForm)
  const [activeSection, setActiveSection] = useState('A')
  const [loading, setLoading] = useState('')
  const [nextCheck, setNextCheck] = useState<number | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const [caseTab, setCaseTab] = useState<'assessment' | 'chat'>('assessment')
  const [review, setReview] = useState<any>(null)

  useEffect(() => {
    loadCases()
  }, [])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const loadCases = async () => {
    const res = await api.get('/api/history')
    setCases(res.data)
  }

  const setField = (section: string | null, field: string, value: any) => {
    if (section) setForm(f => ({ ...f, [section]: { ...(f as any)[section], [field]: value } }))
    else setForm(f => ({ ...f, [field]: value }))
  }

  const isFormValid = () => {
    return form.problem_description.trim() !== '' &&
      form.patient_info.name.trim() !== '' &&
      form.patient_info.ship_name.trim() !== '' &&
      form.breathing.breaths_per_min !== '' &&
      form.breathing.oxygen_saturation_pct !== '' &&
      form.circulation.pulse_per_min !== '' &&
      form.disability.consciousness_level !== ''
  }

  const handleSubmit = async () => {
  setLoading('submit')
  try {
    const sessionRes = await api.post('/api/session/new')
    const session_id = sessionRes.data.session_id
    const payload = { ...cleanForm(form), session_id }

    const [res, reviewRes] = await Promise.all([
      api.post('/api/respond', payload),
      api.post('/api/review', payload)
    ])

    const pn = encodeURIComponent(form.patient_info.name)
    const ps = encodeURIComponent(form.problem_description.slice(0, 100))
    await api.patch(`/api/session/${session_id}/patient?patient_name=${pn}&problem_summary=${ps}`)

    setReview(reviewRes.data)
    setCaseTab('assessment')
    setActiveCase({
      session_id,
      patient_name: form.patient_info.name,
      problem_summary: form.problem_description.slice(0, 100),
      status: 'ongoing',
      created_at: new Date().toISOString()
    })
    setMessages([{
      role: 'assistant',
      content: res.data.full_response_text,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }])
    setNextCheck(res.data.next_report_in_minutes)
    setScreen('case')
    loadCases()
  } catch (e) { console.error(e) }
  finally { setLoading('') }
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !activeCase) return
    const userMsg: Message = {
      role: 'user',
      content: chatInput,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(m => [...m, userMsg])
    setChatInput('')
    setLoading('chat')

    try {
      const res = await api.post('/api/chat', {
        session_id: activeCase.session_id,
        message: chatInput,
        record_summary: activeCase.problem_summary
      })

      const data = res.data
      const aiMsg: Message = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(m => [...m, aiMsg])
      setNextCheck(data.next_check_minutes)

      const updatedCase = { ...activeCase, status: data.case_status as CaseStatus }
      setActiveCase(updatedCase)

      await api.patch(`/api/session/${activeCase.session_id}/status`, null, {
        params: { status: data.case_status }
      })
      loadCases()
    } catch (e) { console.error(e) }
    finally { setLoading('') }
  }

  const openCase = async (c: Case) => {
  setActiveCase(c)
  setReview(null)
  setCaseTab('assessment')
  try {
    const [msgsRes, reviewRes] = await Promise.all([
      api.get(`/api/session/${c.session_id}/messages`),
      api.get(`/api/session/${c.session_id}/review`)
    ])
    setMessages(msgsRes.data)
    setReview(reviewRes.data)
  } catch {
    setMessages([])
  }
  setScreen('case')
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────
  if (screen === 'dashboard') return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif" }} className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">M</div>
          <div>
            <div className="font-bold text-gray-900">MedRadio-AI</div>
            <div className="text-xs text-gray-400">Centre for Maritime Health Services</div>
          </div>
        </div>
        <button onClick={() => { setForm(initialForm); setScreen('form') }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
          + New Case
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="font-bold text-gray-800 text-lg mb-4">Cases</h2>

        {cases.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🚢</div>
            <h3 className="font-bold text-gray-700 mb-1">No cases yet</h3>
            <p className="text-gray-400 text-sm">Click "New Case" to start a training session</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map(c => {
              const st = statusConfig[c.status as CaseStatus] || statusConfig.ongoing
              return (
                <div key={c.session_id} onClick={() => openCase(c)}
                  className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${st.bg} ${st.color}`}>
                    {st.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800">{c.patient_name || 'Unknown Patient'}</div>
                    <div className="text-sm text-gray-500 truncate">{c.problem_summary || 'No description'}</div>
                  </div>
                  <div className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</div>
                  <span className="text-gray-300">›</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  // ── FORM ───────────────────────────────────────────────────────────────
  if (screen === 'form') return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif" }} className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => setScreen('dashboard')} className="text-gray-400 hover:text-gray-700 text-sm">← Back</button>
        <div className="font-bold text-gray-900">New Case — Radio Medical Record</div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">

        {/* Patient Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><span>👤</span> Patient Information</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              ['NAME / TITLE *', 'patient_info', 'name', 'Full name'],
              ['BIRTHDATE / CPR', 'patient_info', 'birthdate', 'DD-MM-YYYY'],
            ].map(([label, sec, field, ph]) => (
              <div key={field}>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
                <input value={(form as any)[sec][field]} onChange={e => setField(sec, field, e.target.value)}
                  placeholder={ph} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">GENDER</label>
              <div className="mt-1 flex gap-2">
                {['Male','Female','Other'].map(g => (
                  <button key={g} onClick={() => setField('patient_info','gender',g.toLowerCase())}
                    className={`flex-1 py-2 text-sm border rounded-lg transition-all ${form.patient_info.gender === g.toLowerCase() ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>{g}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              ['NATIONALITY', 'patient_info', 'nationality', 'Nationality'],
              ['SHIP NAME *', 'patient_info', 'ship_name', 'Vessel name'],
              ['SHIPPING COMPANY', 'patient_info', 'shipping_company', 'Company'],
              ['SHIP E-MAIL', 'patient_info', 'ship_email', 'ship@email.com'],
              ['WHATSAPP', 'patient_info', 'whatsapp', '+45 ...'],
              ['SATELLITE CALL NO.', 'patient_info', 'satellite_call', 'Sat number'],
              ['CALL SIGNAL', 'patient_info', 'call_signal', 'Call signal'],
              ['COORDINATES', 'patient_info', 'coordinates', 'Lat / Long'],
              ['DESTINATION / ETA', 'patient_info', 'destination_eta', 'Port / ETA'],
              ['NEAREST PORT / ETA', 'patient_info', 'nearest_port_eta', 'Port / ETA'],
              ['MEDICINE CHEST', 'patient_info', 'medicine_chest', 'Chest type'],
            ].map(([label, sec, field, ph]) => (
              <div key={field}>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
                <input value={(form as any)[sec][field] || ''} onChange={e => setField(sec, field, e.target.value)}
                  placeholder={ph} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Problem Description */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><span>⚠️</span> Problem Description *</h2>
          <textarea value={form.problem_description} onChange={e => setField(null,'problem_description',e.target.value)}
            rows={4} placeholder="What happened - where - when - patient's symptoms..."
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none" />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current medications</label>
              <input onChange={e => setForm(f => ({ ...f, pre_contact_medications: e.target.value.split(',').map(m => m.trim()).filter(Boolean) }))}
                placeholder="List medications (comma separated)"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Allergies</label>
              <input placeholder="List allergies..."
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>

        {/* ABCDE */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-800 mb-5 flex items-center gap-2"><span>🔍</span> ABCDE Assessment</h2>
          <div className="flex gap-6">
            <div className="w-44 flex-shrink-0 space-y-1">
              {SECTIONS.map(s => {
                const vals = Object.values((form as any)[s.key]).filter(v => v !== null && v !== '' && v !== undefined)
                const done = vals.length > 0
                return (
                  <button key={s.id} onClick={() => setActiveSection(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${activeSection === s.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all"
                      style={{ borderColor: done ? s.color : activeSection === s.id ? s.color : '#d1d5db', backgroundColor: done ? s.color : 'transparent', color: done ? 'white' : activeSection === s.id ? s.color : '#9ca3af' }}>
                      {done ? '✓' : s.id}
                    </div>
                    <span className={`text-sm font-medium ${activeSection === s.id ? 'text-blue-700' : 'text-gray-600'}`}>{s.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex-1 border-l-4 pl-6" style={{ borderColor: SECTIONS.find(s => s.id === activeSection)?.color }}>

              {activeSection === 'A' && (
                <div className="space-y-4">
                  <div><h3 className="font-bold text-gray-800 text-lg">A — Airway</h3><p className="text-gray-500 text-sm">Assess and manage the airway</p></div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CLEAR AIRWAYS</label><div className="mt-2"><YesNo value={form.airway.clear_airways} onChange={v => setField('airway','clear_airways',v)} /></div></div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">IF NO — ACTIONS TAKEN</label>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {[['jaw_lift','Jaw lift'],['suction_applied','Suction applied'],['guedel_airway','Guedel airway']].map(([f,l]) => (
                        <button key={f} onClick={() => setField('airway',f,!(form.airway as any)[f])}
                          className={`px-4 py-1.5 text-sm border rounded-lg transition-all ${(form.airway as any)[f] ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">OXYGEN L/MIN</label><input type="number" value={form.airway.oxygen_lmin} onChange={e => setField('airway','oxygen_lmin',e.target.value)} placeholder="L/min" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" /></div>
                    <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">OXYGEN DEVICE</label>
                      <select value={form.airway.oxygen_device} onChange={e => setField('airway','oxygen_device',e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400">
                        <option value="">Select...</option>
                        <option value="nasal_cannula">Nasal Cannula (≤5 L/min)</option>
                        <option value="hudson_mask">Hudson Mask (&gt;10 L/min)</option>
                      </select>
                    </div>
                  </div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">NECK / BACK SUSPICION OF INJURY</label><div className="mt-2"><YesNo value={form.airway.neck_back_injury_suspected} onChange={v => setField('airway','neck_back_injury_suspected',v)} /></div></div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CPR INITIATED AT</label><input type="time" value={form.airway.cpr_initiated} onChange={e => setField('airway','cpr_initiated',e.target.value)} className="mt-1 w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" /></div>
                </div>
              )}

              {activeSection === 'B' && (
                <div className="space-y-4">
                  <div><h3 className="font-bold text-gray-800 text-lg">B — Breathing *</h3><p className="text-gray-500 text-sm">Assess breathing frequency and depth</p></div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">DESCRIPTION</label>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {['fast','slow','shallow','deep','normal'].map(v => (
                        <button key={v} onClick={() => setField('breathing','breathing_description',v)}
                          className={`px-4 py-1.5 text-sm border rounded-lg capitalize transition-all ${form.breathing.breathing_description === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">BREATHS /MIN * <span className="normal-case font-normal">(12–16)</span></label>
                      <input type="number" value={form.breathing.breaths_per_min} onChange={e => setField('breathing','breaths_per_min',e.target.value)}
                        className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${form.breathing.breaths_per_min && (Number(form.breathing.breaths_per_min)<12||Number(form.breathing.breaths_per_min)>16) ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-blue-400'}`} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SPO2 % * <span className="normal-case font-normal">(95–100)</span></label>
                      <input type="number" value={form.breathing.oxygen_saturation_pct} onChange={e => setField('breathing','oxygen_saturation_pct',e.target.value)}
                        className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${form.breathing.oxygen_saturation_pct && Number(form.breathing.oxygen_saturation_pct)<95 ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-blue-400'}`} />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'C' && (
                <div className="space-y-4">
                  <div><h3 className="font-bold text-gray-800 text-lg">C — Circulation *</h3><p className="text-gray-500 text-sm">Assess circulatory status</p></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PULSE /MIN * <span className="normal-case font-normal">(60–80)</span></label>
                      <input type="number" value={form.circulation.pulse_per_min} onChange={e => setField('circulation','pulse_per_min',e.target.value)}
                        className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${form.circulation.pulse_per_min && (Number(form.circulation.pulse_per_min)<60||Number(form.circulation.pulse_per_min)>80) ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-blue-400'}`} />
                    </div>
                    <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">MEASURED AT</label>
                      <div className="mt-1 flex gap-2">
                        {['wrist','neck','groin'].map(l => (
                          <button key={l} onClick={() => setField('circulation','pulse_location',l)}
                            className={`flex-1 py-2 text-sm border rounded-lg capitalize transition-all ${form.circulation.pulse_location===l ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">BP SYSTOLIC <span className="normal-case font-normal">(120–140)</span></label><input type="number" value={form.circulation.blood_pressure_systolic} onChange={e => setField('circulation','blood_pressure_systolic',e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" /></div>
                    <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">BP DIASTOLIC <span className="normal-case font-normal">(60–90)</span></label><input type="number" value={form.circulation.blood_pressure_diastolic} onChange={e => setField('circulation','blood_pressure_diastolic',e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" /></div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CAPILLARY REFILL (SEC) <span className="normal-case font-normal">(&lt;2)</span></label>
                      <input type="number" step="0.1" value={form.circulation.capillary_response_sec} onChange={e => setField('circulation','capillary_response_sec',e.target.value)}
                        className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${form.circulation.capillary_response_sec && Number(form.circulation.capillary_response_sec)>2 ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-blue-400'}`} />
                    </div>
                    <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SKIN COLOR</label>
                      <div className="mt-1 flex gap-2 flex-wrap">
                        {['pale','reddish','bluish','normal'].map(c => (
                          <button key={c} onClick={() => setField('circulation','skin_color',c)}
                            className={`px-3 py-1.5 text-sm border rounded-lg capitalize transition-all ${form.circulation.skin_color===c ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>{c}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">VENOUS CANNULA INSERTED</label><div className="mt-2"><YesNo value={form.circulation.venous_cannula} onChange={v => setField('circulation','venous_cannula',v)} /></div></div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SKIN TEMPERATURE / HUMIDITY</label><input value={form.circulation.skin_temperature_description} onChange={e => setField('circulation','skin_temperature_description',e.target.value)} placeholder="e.g. cold and clammy..." className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" /></div>
                </div>
              )}

              {activeSection === 'D' && (
                <div className="space-y-4">
                  <div><h3 className="font-bold text-gray-800 text-lg">D — Disability *</h3><p className="text-gray-500 text-sm">Assess level of consciousness</p></div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">LEVEL OF CONSCIOUSNESS *</label>
                    <div className="mt-2 space-y-2">
                      {[[1,'Awake, alert and well orientated'],[2,'Unclear, but responds to questions'],[3,'Does not respond to questions but to pain stimuli'],[4,'Unconscious and unresponsive to pain stimuli']].map(([val,label]) => (
                        <button key={val} onClick={() => setField('disability','consciousness_level',val)}
                          className={`w-full text-left px-4 py-3 text-sm border rounded-lg transition-all ${form.disability.consciousness_level==val ? 'bg-purple-50 border-purple-400 text-purple-800 font-medium' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}>
                          {val}. {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CONVULSIONS</label><div className="mt-2"><YesNo value={form.disability.convulsions} onChange={v => setField('disability','convulsions',v)} /></div></div>
                    <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PARALYSIS</label><div className="mt-2"><YesNo value={form.disability.paralysis} onChange={v => setField('disability','paralysis',v)} /></div></div>
                  </div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PUPIL REACTION</label>
                    <div className="mt-2 flex gap-2">
                      {[[true,'Normal (uniform contraction)'],[false,'Abnormal - describe']].map(([val,label]) => (
                        <button key={String(val)} onClick={() => setField('disability','pupil_reaction_normal',val)}
                          className={`px-4 py-2 text-sm border rounded-lg transition-all ${form.disability.pupil_reaction_normal===val ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>{label as string}</button>
                      ))}
                    </div>
                    {form.disability.pupil_reaction_normal === false && (
                      <input value={form.disability.pupil_description} onChange={e => setField('disability','pupil_description',e.target.value)} placeholder="Describe pupil abnormality..." className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'E' && (
                <div className="space-y-4">
                  <div><h3 className="font-bold text-gray-800 text-lg">E — Expose</h3><p className="text-gray-500 text-sm">Full body examination</p></div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">TOP TO TOE PERFORMED</label><div className="mt-2"><YesNo value={form.expose.top_to_toe_performed} onChange={v => setField('expose','top_to_toe_performed',v)} /></div></div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SIGNS OF INJURY / ILLNESS</label><div className="mt-2"><YesNo value={form.expose.injury_illness_found} onChange={v => setField('expose','injury_illness_found',v)} /></div>
                    {form.expose.injury_illness_found && <input value={form.expose.injury_description} onChange={e => setField('expose','injury_description',e.target.value)} placeholder="Describe findings..." className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />}
                  </div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">HYPOTHERMIA / OVERHEATING</label><div className="mt-2"><YesNo value={form.expose.hypothermia_overheating} onChange={v => setField('expose','hypothermia_overheating',v)} /></div></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">TEMPERATURE MOUTH °C</label><input type="number" step="0.1" value={form.expose.temperature_mouth} onChange={e => setField('expose','temperature_mouth',e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" /></div>
                    <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">TEMPERATURE RECTAL °C</label><input type="number" step="0.1" value={form.expose.temperature_rectal} onChange={e => setField('expose','temperature_rectal',e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" /></div>
                  </div>
                  <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PERFORMED ACTIONS</label><input value={form.performed_actions} onChange={e => setField(null,'performed_actions',e.target.value)} placeholder="Actions taken before contact..." className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" /></div>
                </div>
              )}

              <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
                <button onClick={() => { const i=SECTIONS.findIndex(s=>s.id===activeSection); if(i>0) setActiveSection(SECTIONS[i-1].id) }} disabled={activeSection==='A'} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 disabled:opacity-40">← Previous</button>
                <button onClick={() => { const i=SECTIONS.findIndex(s=>s.id===activeSection); if(i<SECTIONS.length-1) setActiveSection(SECTIONS[i+1].id) }} disabled={activeSection==='E'} className="px-4 py-2 text-sm border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-40">Next →</button>
              </div>
            </div>
          </div>
        </div>

        {!isFormValid() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
            ⚠️ Required fields: Patient name, Ship name, Problem description, Breathing rate, SpO2, Pulse, and Consciousness level
          </div>
        )}

        <button onClick={handleSubmit} disabled={!isFormValid() || !!loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
          {loading === 'submit' ? <><span className="animate-spin">⟳</span> Submitting to Radio Medical...</> : <>📡 Submit to Radio Medical</>}
        </button>
      </div>
    </div>
  )

  // ── CASE VIEW ──────────────────────────────────────────────────────────
  if (screen === 'case' && activeCase) {
    const st = statusConfig[activeCase.status] || statusConfig.ongoing
    return (
      <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif" }} className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <button onClick={() => { setScreen('dashboard'); loadCases() }} className="text-gray-400 hover:text-gray-700 text-sm">← Cases</button>
          <div className="flex-1">
            <div className="font-bold text-gray-900">{activeCase.patient_name || 'Patient'}</div>
            <div className="text-xs text-gray-400 truncate max-w-md">{activeCase.problem_summary}</div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${st.bg} ${st.color}`}>{st.label}</div>
          {nextCheck && activeCase.status !== 'closed' && (
            <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              Next check: <span className="font-semibold text-blue-600">{nextCheck} min</span>
            </div>
          )}
          {activeCase.status !== 'closed' && (
            <button onClick={async () => {
              await api.patch(`/api/session/${activeCase.session_id}/status?status=closed`)
              setActiveCase({ ...activeCase, status: 'closed' })
              loadCases()
            }}
              className="text-xs text-red-500 border border-red-200 px-3 py-1 rounded-full hover:bg-red-50 transition-colors">
              Close Case
            </button>
          )}
        </header>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-6">
          <div className="flex gap-1 max-w-5xl mx-auto">
            {[
              { id: 'assessment', icon: '📋', label: 'AI Assessment' },
              { id: 'chat',       icon: '💬', label: 'Radio Medical Chat' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setCaseTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${caseTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <span>{tab.icon}</span>{tab.label}
                {tab.id === 'chat' && messages.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{messages.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Assessment Tab */}
        {caseTab === 'assessment' && (
          <div className="flex-1 overflow-y-auto px-6 py-6 max-w-5xl mx-auto w-full">
            {!review ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-sm">No assessment available for this case.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Scores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                    <div className="w-16 h-16 relative flex items-center justify-center">
                      <svg className="-rotate-90 absolute" width="64" height="64">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="#e5e7eb" strokeWidth="6"/>
                        <circle cx="32" cy="32" r="26" fill="none"
                          stroke={review.completeness_score >= 0.8 ? '#22c55e' : review.completeness_score >= 0.5 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="6" strokeDasharray={163.4}
                          strokeDashoffset={163.4 - (review.completeness_score * 163.4)}
                          strokeLinecap="round"/>
                      </svg>
                      <span className="text-sm font-bold relative z-10">{Math.round(review.completeness_score * 100)}%</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-700">Completeness</div>
                      <div className="text-xs text-gray-400">Form documentation</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                    <div className="w-16 h-16 relative flex items-center justify-center">
                      <svg className="-rotate-90 absolute" width="64" height="64">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="#e5e7eb" strokeWidth="6"/>
                        <circle cx="32" cy="32" r="26" fill="none"
                          stroke={review.clinical_safety_score >= 0.8 ? '#22c55e' : review.clinical_safety_score >= 0.5 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="6" strokeDasharray={163.4}
                          strokeDashoffset={163.4 - (review.clinical_safety_score * 163.4)}
                          strokeLinecap="round"/>
                      </svg>
                      <span className="text-sm font-bold relative z-10">{Math.round(review.clinical_safety_score * 100)}%</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-700">Clinical Safety</div>
                      <div className="text-xs text-gray-400">Patient safety score</div>
                    </div>
                  </div>
                </div>

                {/* Overall assessment */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Overall Assessment</div>
                  <p className="text-sm text-blue-900">{review.overall_assessment}</p>
                </div>

                {/* Deficiencies */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Deficiencies ({review.deficiencies.length})
                  </div>
                  <div className="space-y-2">
                    {review.deficiencies.length === 0 ? (
                      <p className="text-sm text-green-600">✓ No deficiencies found</p>
                    ) : review.deficiencies.map((d, i) => (
                      <div key={i} className={`p-3 rounded-lg border ${d.severity === 'CRITICAL' ? 'bg-red-50 border-red-200' : d.severity === 'WARNING' ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-100'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${d.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-200' : d.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-blue-100 text-blue-700 border-blue-100'}`}>
                            {d.severity}
                          </span>
                          <span className="text-xs text-gray-500">Section {d.section}{d.field ? ` — ${d.field}` : ''}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800">{d.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">→ {d.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {caseTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl mx-auto w-full" ref={chatRef}>
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <div className="text-4xl mb-3">📡</div>
                  <p className="text-sm">No messages yet.</p>
                  <p className="text-sm mt-1">Type an update to contact Radio Medical Denmark.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-3 flex-shrink-0 mt-1">RM</div>
                      )}
                      <div className={`max-w-lg rounded-2xl px-4 py-3 ${msg.role === 'assistant' ? 'bg-white border border-gray-200 shadow-sm' : 'bg-blue-600 text-white'}`}>
                        {msg.role === 'assistant' && (
                          <div className="text-xs font-bold text-blue-600 mb-1">Radio Medical Denmark · {msg.timestamp}</div>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                        {msg.role === 'user' && (
                          <div className="text-xs text-blue-200 mt-1 text-right">{msg.timestamp}</div>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-bold ml-3 flex-shrink-0 mt-1">MO</div>
                      )}
                    </div>
                  ))}
                  {loading === 'chat' && (
                    <div className="flex justify-start">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-3">RM</div>
                      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                        <div className="text-xs font-bold text-blue-600 mb-1">Radio Medical Denmark</div>
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {activeCase.status === 'closed' ? (
              <div className="bg-gray-100 border-t border-gray-200 px-6 py-4 text-center text-sm text-gray-500">
                This case is closed. <button onClick={() => setScreen('dashboard')} className="text-blue-600 hover:underline">Return to dashboard</button>
              </div>
            ) : (
              <div className="bg-white border-t border-gray-200 px-6 py-4">
                <div className="max-w-3xl mx-auto flex gap-3">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
                    placeholder="Report patient update to Radio Medical..."
                    disabled={!!loading}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50" />
                  <button onClick={handleChat} disabled={!chatInput.trim() || !!loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors">
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return null
}