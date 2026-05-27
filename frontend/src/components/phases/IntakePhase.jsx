'use client'

import { useState } from 'react'
import { useSession, PHASES } from '@/contexts/SessionContext'
import { useVapi } from '@/contexts/VapiContext'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

const pillBtn = (active) => ({
  padding: '7px 18px',
  border: `1px solid ${active ? 'rgba(0,170,255,0.6)' : 'rgba(0,170,255,0.15)'}`,
  borderRadius: '20px',
  background: active ? 'rgba(0,170,255,0.1)' : 'transparent',
  color: active ? '#7dd4f8' : 'rgba(160,200,220,0.45)',
  fontSize: '13px', cursor: 'pointer',
  transition: 'all 0.2s',
})

const inputStyle = {
  width: '100%', padding: '9px 14px', boxSizing: 'border-box',
  background: 'rgba(0,12,28,0.5)',
  border: '1px solid rgba(0,170,255,0.12)', borderRadius: '8px',
  color: '#c8e8ff', fontSize: '14px', outline: 'none',
  fontWeight: 300,
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
    stopSession()

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
    } catch {
      console.warn('[Intake] Backend unavailable, continuing offline')
    }

    setPhase(PHASES.PAIN_SELECT)
    setSubmitting(false)
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'linear-gradient(to top, rgba(3,10,22,0.98) 55%, transparent)',
      animation: 'slideUp 0.45s cubic-bezier(0.4,0,0.2,1) forwards',
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        padding: '28px 24px 32px',
        marginBottom: '4vh',
      }}>
        {/* Heading */}
        <div style={{ marginBottom: '22px' }}>
          <p style={{
            fontSize: '13px', color: 'rgba(0,170,255,0.4)',
            letterSpacing: '0.12em', marginBottom: '6px', fontWeight: 400,
          }}>
            before we begin
          </p>
          <h2 style={{
            fontSize: '22px', color: '#d4eeff', fontWeight: 300,
            letterSpacing: '-0.01em', margin: 0,
          }}>
            Tell us about yourself
          </h2>
        </div>

        {/* Age */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', color: 'rgba(160,200,220,0.5)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>
            age
          </label>
          <input
            type="number" min="1" max="120"
            value={form.age}
            onChange={(e) => update('age', e.target.value)}
            placeholder="Your age"
            style={inputStyle}
          />
        </div>

        {/* Biological Sex */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', color: 'rgba(160,200,220,0.5)', display: 'block', marginBottom: '8px', letterSpacing: '0.08em' }}>
            biological sex
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Male', 'Female', 'Other'].map((opt) => (
              <button key={opt} onClick={() => update('biologicalSex', opt)} style={pillBtn(form.biologicalSex === opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Optional toggle */}
        <button
          onClick={() => setShowOptional(!showOptional)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(0,170,255,0.4)', fontSize: '12px',
            letterSpacing: '0.08em', marginBottom: '16px', padding: '0',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}
        >
          <span style={{ fontSize: '9px', transition: 'transform 0.2s', display: 'inline-block', transform: showOptional ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          add more context
        </button>

        {showOptional && (
          <div style={{ marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'rgba(160,200,220,0.5)', display: 'block', marginBottom: '8px', letterSpacing: '0.08em' }}>
                how did the pain start?
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Sudden', 'Gradual', 'On and off'].map((opt) => (
                  <button key={opt} onClick={() => update('painOnset', opt)} style={pillBtn(form.painOnset === opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'rgba(160,200,220,0.5)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>
                chronic conditions
              </label>
              <input
                value={form.chronicConditions}
                onChange={(e) => update('chronicConditions', e.target.value)}
                placeholder="e.g. diabetes, arthritis..."
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'rgba(160,200,220,0.5)', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>
                current medications
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

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          style={{
            width: '100%', padding: '13px',
            background: isValid ? 'rgba(0,100,220,0.18)' : 'transparent',
            border: `1px solid ${isValid ? 'rgba(0,170,255,0.5)' : 'rgba(0,170,255,0.1)'}`,
            borderRadius: '10px',
            color: isValid ? '#7dd4f8' : 'rgba(160,200,220,0.25)',
            fontSize: '13px', letterSpacing: '0.08em',
            cursor: isValid ? 'pointer' : 'default',
            transition: 'all 0.25s',
            backdropFilter: 'blur(8px)',
          }}
        >
          {submitting ? 'starting...' : 'mark your pain points →'}
        </button>
      </div>
    </div>
  )
}
