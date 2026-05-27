'use client'

import { useState } from 'react'
import { useSession, PHASES } from '@/contexts/SessionContext'
import { useVapi } from '@/contexts/VapiContext'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

const pillBtn = (active) => ({
  padding: '8px 16px',
  border: `1px solid ${active ? '#00aaff' : 'rgba(0,170,255,0.3)'}`,
  borderRadius: '20px',
  background: active ? 'rgba(0,170,255,0.15)' : 'transparent',
  color: active ? '#00d0ff' : '#5a90b0',
  fontSize: '13px', cursor: 'pointer',
  transition: 'all 0.2s',
  fontFamily: 'monospace',
})

const inputStyle = {
  width: '100%', padding: '10px 14px', boxSizing: 'border-box',
  background: 'rgba(0,20,40,0.8)',
  border: '1px solid rgba(0,170,255,0.2)', borderRadius: '8px',
  color: '#e0f4ff', fontSize: '14px', outline: 'none',
}

export default function IntakePhase() {
  const { setIntake, setPhase, setSessionId } = useSession()
  const { stopSession } = useVapi()
  const [form, setForm] = useState({
    age: '',
    biologicalSex: '',
    painOnset: '',
    chronicConditions: '',
    medications: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [showOptional, setShowOptional] = useState(false)

  const isValid = form.age && form.biologicalSex

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }))

  const handleSubmit = async () => {
    if (!isValid || submitting) return
    setSubmitting(true)
    setIntake(form)
    stopSession() // stop the intro session

    try {
      const res = await fetch(`${API_BASE}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const data = await res.json()
        setSessionId(data.sessionId)
      }
    } catch (err) {
      // Proceed even if backend is unavailable (demo mode)
      console.warn('[Intake] Backend unavailable, continuing offline')
    }

    setPhase(PHASES.PAIN_SELECT)
    setSubmitting(false)
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'linear-gradient(to top, rgba(4,13,26,0.97) 60%, transparent)',
      animation: 'slideUp 0.5s cubic-bezier(0.4,0,0.2,1) forwards',
    }}>
      <div style={{
        width: '100%', maxWidth: '480px',
        padding: '32px 28px',
        marginBottom: '5vh',
        background: 'rgba(6,14,30,0.96)',
        border: '1px solid rgba(0,170,255,0.2)',
        borderRadius: '16px 16px 0 0',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', color: '#00aaff', fontFamily: 'monospace', letterSpacing: '0.2em', marginBottom: '6px' }}>
            PATIENT INTAKE
          </div>
          <div style={{ fontSize: '20px', color: '#e0f4ff', fontWeight: 300 }}>
            Tell us about yourself
          </div>
        </div>

        {/* Age */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '12px', color: '#5a90b0', fontFamily: 'monospace', display: 'block', marginBottom: '6px' }}>
            AGE *
          </label>
          <input
            type="number" min="1" max="120"
            value={form.age}
            onChange={(e) => update('age', e.target.value)}
            placeholder="Enter your age"
            style={inputStyle}
          />
        </div>

        {/* Biological Sex */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '12px', color: '#5a90b0', fontFamily: 'monospace', display: 'block', marginBottom: '8px' }}>
            BIOLOGICAL SEX *
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Male', 'Female', 'Other'].map((opt) => (
              <button key={opt} onClick={() => update('biologicalSex', opt)} style={pillBtn(form.biologicalSex === opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Optional section toggle */}
        <button
          onClick={() => setShowOptional(!showOptional)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#00aaff', fontSize: '12px', fontFamily: 'monospace',
            letterSpacing: '0.1em', marginBottom: '16px', padding: '0',
          }}
        >
          {showOptional ? '▾' : '▸'} HELP US HELP YOU (optional)
        </button>

        {showOptional && (
          <div style={{ marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Pain Onset */}
            <div>
              <label style={{ fontSize: '12px', color: '#5a90b0', fontFamily: 'monospace', display: 'block', marginBottom: '8px' }}>
                HOW DID THE PAIN START?
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Sudden', 'Gradual', 'Came & went'].map((opt) => (
                  <button key={opt} onClick={() => update('painOnset', opt)} style={pillBtn(form.painOnset === opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Chronic conditions */}
            <div>
              <label style={{ fontSize: '12px', color: '#5a90b0', fontFamily: 'monospace', display: 'block', marginBottom: '6px' }}>
                CHRONIC CONDITIONS
              </label>
              <input
                value={form.chronicConditions}
                onChange={(e) => update('chronicConditions', e.target.value)}
                placeholder="e.g. diabetes, arthritis..."
                style={inputStyle}
              />
            </div>

            {/* Medications */}
            <div>
              <label style={{ fontSize: '12px', color: '#5a90b0', fontFamily: 'monospace', display: 'block', marginBottom: '6px' }}>
                CURRENT MEDICATIONS
              </label>
              <input
                value={form.medications}
                onChange={(e) => update('medications', e.target.value)}
                placeholder="e.g. ibuprofen, metformin..."
                style={inputStyle}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          style={{
            width: '100%', padding: '14px',
            background: isValid ? 'linear-gradient(135deg, #0055cc, #0033aa)' : '#0a1a2e',
            border: `1px solid ${isValid ? '#00aaff' : 'rgba(0,170,255,0.2)'}`,
            borderRadius: '10px', color: isValid ? '#e0f4ff' : '#3a6080',
            fontSize: '14px', fontFamily: 'monospace', letterSpacing: '0.1em',
            cursor: isValid ? 'pointer' : 'default',
            boxShadow: isValid ? '0 0 20px rgba(0,85,204,0.3)' : 'none',
            transition: 'all 0.3s',
          }}
        >
          {submitting ? 'INITIALIZING...' : 'SELECT PAIN POINTS →'}
        </button>
      </div>
    </div>
  )
}
