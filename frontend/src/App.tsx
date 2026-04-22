import { useState } from 'react'
import { newSession, reviewReport, generateResponse } from './api/client'

const initialForm = {
  problem_description: '',
  patient_info: { name: '', ship_name: '', nationality: '' },
  airway: { clear_airways: null, oxygen_lmin: '', oxygen_device: '' },
  breathing: { breathing_description: '', breaths_per_min: '', oxygen_saturation_pct: '' },
  circulation: { pulse_per_min: '', skin_color: '', capillary_response_sec: '', blood_pressure_systolic: '', blood_pressure_diastolic: '' },
  disability: { consciousness_level: '', convulsions: null, paralysis: null },
  expose: { top_to_toe_performed: null, injury_illness_found: null, injury_description: '', temperature_mouth: '' },
  pre_contact_medications: [],
}

const cleanForm = (form) => {
  const clean = (obj) => {
    if (obj === null || obj === undefined) return null
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => {
          if (v === '' || v === null || v === undefined) return [k, null]
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

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [review, setReview] = useState(null)
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState('')
  const [activeTab, setActiveTab] = useState('form')

  const startSession = async () => {
    const res = await newSession()
    setSessionId(res.data.session_id)
  }

  const handleReview = async () => {
  setLoading('review')
  try {
    const payload = { ...cleanForm(form), session_id: sessionId }
    console.log('Sending:', JSON.stringify(payload, null, 2))
    const res = await reviewReport(payload)
    setReview(res.data)
    setActiveTab('review')
  } catch(e) { console.error(e) }
  finally { setLoading('') }
  }

  const handleRespond = async () => {
    setLoading('respond')
    try {
      const res = await generateResponse({ ...cleanForm(form), session_id: sessionId })
      setResponse(res.data)
      setActiveTab('response')
    } catch(e) { console.error(e) }
    finally { setLoading('') }
  }

  const set = (section, field, value) => {
    if (section) {
      setForm(f => ({ ...f, [section]: { ...f[section], [field]: value } }))
    } else {
      setForm(f => ({ ...f, [field]: value }))
    }
  }

  const severityColor = (s) => ({
    CRITICAL: 'bg-red-500/20 text-red-300 border-red-500/40',
    WARNING: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    INFO: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  }[s] || '')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mono">
      {/* Header */}
      <header className="border-b border-amber-500/30 bg-slate-900/80 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-amber-400 text-xl font-bold tracking-widest uppercase">MedRadio-AI</h1>
            <p className="text-slate-400 text-xs tracking-wider">Centre for Maritime Health Services</p>
          </div>
          {sessionId ? (
            <div className="text-right">
              <div className="text-green-400 text-xs">● SESSION ACTIVE</div>
              <div className="text-slate-500 text-xs">{sessionId.slice(0, 8)}...</div>
            </div>
          ) : (
            <button onClick={startSession}
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 py-2 text-sm tracking-wider uppercase transition-colors">
              New Session
            </button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-700">
          {['form', 'review', 'response'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs uppercase tracking-widest transition-colors ${activeTab === tab ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-300'}`}>
              {tab === 'form' ? 'Radio Medical Record' : tab === 'review' ? 'AI Review' : 'Training Response'}
            </button>
          ))}
        </div>

        {/* FORM TAB */}
        {activeTab === 'form' && (
          <div className="space-y-6">
            {/* Patient Info */}
            <section className="border border-slate-700 bg-slate-900/50 p-4">
              <h2 className="text-amber-400 text-xs uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">Patient Information</h2>
              <div className="grid grid-cols-3 gap-4">
                {[['Name', 'patient_info', 'name'], ['Ship', 'patient_info', 'ship_name'], ['Nationality', 'patient_info', 'nationality']].map(([label, sec, field]) => (
                  <div key={field}>
                    <label className="text-slate-400 text-xs uppercase tracking-wider">{label}</label>
                    <input value={form[sec][field]} onChange={e => set(sec, field, e.target.value)}
                      className="w-full mt-1 bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
                  </div>
                ))}
              </div>
            </section>

            {/* Problem */}
            <section className="border border-slate-700 bg-slate-900/50 p-4">
              <h2 className="text-amber-400 text-xs uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">Problem Description</h2>
              <textarea value={form.problem_description} onChange={e => set(null, 'problem_description', e.target.value)}
                rows={3} placeholder="What happened - where - when - symptoms..."
                className="w-full bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none resize-none" />
            </section>

            {/* A - Airway */}
            <section className="border border-slate-700 bg-slate-900/50 p-4">
              <h2 className="text-amber-400 text-xs uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">A — Airway</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">Oxygen L/min</label>
                  <input type="number" value={form.airway.oxygen_lmin} onChange={e => set('airway', 'oxygen_lmin', e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">Oxygen Device</label>
                  <select value={form.airway.oxygen_device} onChange={e => set('airway', 'oxygen_device', e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none">
                    <option value="">Select...</option>
                    <option value="nasal_cannula">Nasal Cannula</option>
                    <option value="hudson_mask">Hudson Mask</option>
                  </select>
                </div>
              </div>
            </section>

            {/* B - Breathing */}
            <section className="border border-slate-700 bg-slate-900/50 p-4">
              <h2 className="text-amber-400 text-xs uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">B — Breathing</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">Pattern</label>
                  <select value={form.breathing.breathing_description} onChange={e => set('breathing', 'breathing_description', e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none">
                    <option value="">Select...</option>
                    {['fast','slow','shallow','deep','normal'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">Rate /min <span className="text-slate-600">(12-16)</span></label>
                  <input type="number" value={form.breathing.breaths_per_min} onChange={e => set('breathing', 'breaths_per_min', e.target.value)}
                    className={`w-full mt-1 bg-slate-800 border text-slate-100 px-3 py-2 text-sm focus:outline-none ${form.breathing.breaths_per_min && (form.breathing.breaths_per_min < 12 || form.breathing.breaths_per_min > 16) ? 'border-red-500' : 'border-slate-600 focus:border-amber-500'}`} />
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">SpO2 % <span className="text-slate-600">(95-100)</span></label>
                  <input type="number" value={form.breathing.oxygen_saturation_pct} onChange={e => set('breathing', 'oxygen_saturation_pct', e.target.value)}
                    className={`w-full mt-1 bg-slate-800 border text-slate-100 px-3 py-2 text-sm focus:outline-none ${form.breathing.oxygen_saturation_pct && form.breathing.oxygen_saturation_pct < 95 ? 'border-red-500' : 'border-slate-600 focus:border-amber-500'}`} />
                </div>
              </div>
            </section>

            {/* C - Circulation */}
            <section className="border border-slate-700 bg-slate-900/50 p-4">
              <h2 className="text-amber-400 text-xs uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">C — Circulation</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">Pulse /min <span className="text-slate-600">(60-80)</span></label>
                  <input type="number" value={form.circulation.pulse_per_min} onChange={e => set('circulation', 'pulse_per_min', e.target.value)}
                    className={`w-full mt-1 bg-slate-800 border text-slate-100 px-3 py-2 text-sm focus:outline-none ${form.circulation.pulse_per_min && (form.circulation.pulse_per_min < 60 || form.circulation.pulse_per_min > 80) ? 'border-red-500' : 'border-slate-600 focus:border-amber-500'}`} />
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">BP Systolic <span className="text-slate-600">(120-140)</span></label>
                  <input type="number" value={form.circulation.blood_pressure_systolic} onChange={e => set('circulation', 'blood_pressure_systolic', e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">BP Diastolic <span className="text-slate-600">(60-90)</span></label>
                  <input type="number" value={form.circulation.blood_pressure_diastolic} onChange={e => set('circulation', 'blood_pressure_diastolic', e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">Skin Color</label>
                  <select value={form.circulation.skin_color} onChange={e => set('circulation', 'skin_color', e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none">
                    <option value="">Select...</option>
                    {['pale','reddish','bluish','normal'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">Capillary Refill (sec)</label>
                  <input type="number" value={form.circulation.capillary_response_sec} onChange={e => set('circulation', 'capillary_response_sec', e.target.value)}
                    className={`w-full mt-1 bg-slate-800 border text-slate-100 px-3 py-2 text-sm focus:outline-none ${form.circulation.capillary_response_sec && form.circulation.capillary_response_sec > 2 ? 'border-red-500' : 'border-slate-600 focus:border-amber-500'}`} />
                </div>
              </div>
            </section>

            {/* D - Disability */}
            <section className="border border-slate-700 bg-slate-900/50 p-4">
              <h2 className="text-amber-400 text-xs uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">D — Disability</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">Consciousness Level</label>
                  <select value={form.disability.consciousness_level} onChange={e => set('disability', 'consciousness_level', e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none">
                    <option value="">Select...</option>
                    <option value="1">1 — Awake and alert</option>
                    <option value="2">2 — Unclear, responds to questions</option>
                    <option value="3">3 — Responds to pain only</option>
                    <option value="4">4 — Unconscious</option>
                  </select>
                </div>
                <div className="flex gap-6 items-end pb-1">
                  {[['Convulsions', 'convulsions'], ['Paralysis', 'paralysis']].map(([label, field]) => (
                    <label key={field} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={!!form.disability[field]} onChange={e => set('disability', field, e.target.checked)}
                        className="accent-amber-400 w-4 h-4" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* E - Expose */}
            <section className="border border-slate-700 bg-slate-900/50 p-4">
              <h2 className="text-amber-400 text-xs uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">E — Expose</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">Temperature °C <span className="text-slate-600">(36.5)</span></label>
                  <input type="number" step="0.1" value={form.expose.temperature_mouth} onChange={e => set('expose', 'temperature_mouth', e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider">Injury Description</label>
                  <input value={form.expose.injury_description} onChange={e => set('expose', 'injury_description', e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="flex gap-4 pt-2">
              <button onClick={handleReview} disabled={!sessionId || loading === 'review'}
                className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-amber-400 font-bold py-3 text-sm uppercase tracking-widest transition-colors border border-slate-600">
                {loading === 'review' ? '⟳ Analysing...' : '🔍 Review Report'}
              </button>
              <button onClick={handleRespond} disabled={!sessionId || loading === 'respond'}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-bold py-3 text-sm uppercase tracking-widest transition-colors">
                {loading === 'respond' ? '⟳ Generating...' : '📡 Get Radio Response'}
              </button>
            </div>
            {!sessionId && <p className="text-red-400 text-xs text-center">Start a session first before submitting</p>}
          </div>
        )}

        {/* REVIEW TAB */}
        {activeTab === 'review' && review && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-700 bg-slate-900/50 p-4">
                <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Completeness</div>
                <div className="text-3xl font-bold text-amber-400">{Math.round(review.completeness_score * 100)}%</div>
              </div>
              <div className="border border-slate-700 bg-slate-900/50 p-4">
                <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Clinical Safety</div>
                <div className="text-3xl font-bold text-green-400">{Math.round(review.clinical_safety_score * 100)}%</div>
              </div>
            </div>
            <div className="border border-slate-700 bg-slate-900/50 p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">Overall Assessment</div>
              <p className="text-slate-200 text-sm leading-relaxed">{review.overall_assessment}</p>
            </div>
            <div className="border border-slate-700 bg-slate-900/50 p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">Deficiencies ({review.deficiencies.length})</div>
              <div className="space-y-2">
                {review.deficiencies.map((d, i) => (
                  <div key={i} className={`border p-3 ${severityColor(d.severity)}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider">{d.severity}</span>
                      <span className="text-xs opacity-70">Section {d.section}{d.field ? ` — ${d.field}` : ''}</span>
                    </div>
                    <p className="text-sm">{d.description}</p>
                    <p className="text-xs opacity-70 mt-1">→ {d.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RESPONSE TAB */}
        {activeTab === 'response' && response && (
          <div className="space-y-4">
            <div className="border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="text-amber-400 text-xs uppercase tracking-widest mb-3">📡 Radio Medical Response</div>
              <p className="text-slate-200 text-sm leading-relaxed font-mono">{response.full_response_text}</p>
              <div className="mt-3 text-slate-500 text-xs">Next report in: <span className="text-amber-400">{response.next_report_in_minutes} minutes</span></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[['Immediate Actions', response.immediate_actions], ['Monitoring', response.monitoring_parameters], ['Escalation', response.escalation_criteria]].map(([title, content]) => (
                <div key={title} className="border border-slate-700 bg-slate-900/50 p-4">
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">{title}</div>
                  <p className="text-slate-300 text-xs leading-relaxed">{content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}