'use client'

import { useState, useEffect, useCallback } from 'react'
import { pdf } from '@react-pdf/renderer'
import { useSession, PHASES } from '@/contexts/SessionContext'
import ReportDocument from '@/components/ui/ReportDocument'

const NOT_MENTIONED = 'Not mentioned'

const URGENCY = {
  low: { color: '#22c55e', label: 'low' },
  moderate: { color: '#f59e0b', label: 'moderate' },
  high: { color: '#ef4444', label: 'high — seek care soon' },
}

function SectionCard({ label, children }) {
  return (
    <section style={{
      background: 'rgba(6,14,30,0.7)',
      border: '1px solid rgba(0,170,255,0.1)',
      borderRadius: '10px',
      padding: '16px 18px',
      marginBottom: '12px',
    }}>
      <h2 style={{
        fontSize: '10px', color: 'rgba(0,170,255,0.6)',
        letterSpacing: '0.15em', margin: '0 0 12px',
        fontWeight: 400, textTransform: 'uppercase',
      }}>
        {label}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, value }) {
  const missing = !value || value === NOT_MENTIONED
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '5px' }}>
      <span style={{ width: '110px', fontSize: '12px', color: 'rgba(160,200,220,0.45)', flexShrink: 0, fontWeight: 300 }}>{label}</span>
      <span style={{ fontSize: '12px', color: missing ? 'rgba(160,200,220,0.3)' : '#9dc8e4', fontWeight: 300, fontStyle: missing ? 'italic' : 'normal' }}>
        {missing ? 'not mentioned' : value}
      </span>
    </div>
  )
}

function BulletList({ items, numbered }) {
  return items.map((d, i) => (
    <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '7px', alignItems: 'flex-start' }}>
      <span style={{ color: 'rgba(0,170,255,0.6)', fontSize: '12px', minWidth: '14px' }}>{numbered ? `${i + 1}.` : '·'}</span>
      <span style={{ fontSize: '13px', color: '#9dc8e4', fontWeight: 300, lineHeight: '1.55' }}>{d}</span>
    </div>
  ))
}

export default function ReportPhase() {
  const { intake, painPoints, chatHistory, canvasScreenshot, report, setReport, setPhase } = useSession()
  const needsFetch = !report || report.historyLength !== chatHistory.length
  const [loading, setLoading] = useState(needsFetch)
  const [error, setError] = useState('')
  const [pdfState, setPdfState] = useState('idle')
  const data = report?.data

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intake,
          painPoints: painPoints.map((p) => ({ region: p.region })),
          history: chatHistory.map(({ role, content }) => ({ role, content })),
        }),
      })
      if (!res.ok) throw new Error(`report request failed: ${res.status}`)
      const json = await res.json()
      setReport(json.report, chatHistory.length)
    } catch (err) {
      console.warn('[Report] generation failed', err)
      setError('Could not generate the report. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [intake, painPoints, chatHistory, setReport])

  useEffect(() => {
    if (needsFetch) fetchReport()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const downloadPdf = async () => {
    if (!data || pdfState === 'working') return
    setPdfState('working')
    try {
      const blob = await pdf(
        <ReportDocument
          intake={intake}
          painPoints={painPoints}
          chatHistory={chatHistory}
          report={data}
          canvasScreenshot={canvasScreenshot}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `findmypain-report-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setPdfState('idle')
    } catch (err) {
      console.error('[Report] PDF generation failed', err)
      setPdfState('error')
    }
  }

  const urgency = URGENCY[data?.urgency] || { color: '#00aaff', label: 'unknown' }
  const regionDetails = data?.regions?.length ? data.regions : painPoints.map((p) => ({ region: p.region }))

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      background: '#030a16',
      overflowY: 'auto',
      animation: 'fadeIn 0.4s ease forwards',
    }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '28px 16px 80px' }}>

        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'rgba(0,170,255,0.5)', letterSpacing: '0.12em', marginBottom: '5px', marginTop: 0 }}>
              findmypain
            </p>
            <h1 style={{ fontSize: '22px', color: '#d4eeff', fontWeight: 300, margin: 0, letterSpacing: '-0.01em' }}>
              Pain Report
            </h1>
            <p style={{ fontSize: '12px', color: 'rgba(160,200,220,0.45)', margin: '4px 0 0', fontWeight: 300 }}>
              {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => setPhase(PHASES.CHAT)}
            style={{
              background: 'none', border: '1px solid rgba(0,170,255,0.18)',
              borderRadius: '6px', color: 'rgba(160,200,220,0.6)',
              fontSize: '11px', letterSpacing: '0.08em',
              cursor: 'pointer', padding: '6px 11px',
              transition: 'all 0.2s', marginTop: '4px', flexShrink: 0,
            }}
          >
            ← add more detail
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '70px 0' }}>
            <div style={{
              width: '32px', height: '32px',
              border: '1px solid rgba(0,208,255,0.15)',
              borderTop: '1px solid #00d0ff', borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 14px',
            }} />
            <p style={{ color: 'rgba(90,144,176,0.6)', fontSize: '13px', fontWeight: 300 }}>
              summarising your conversation…
            </p>
          </div>
        ) : error || !data ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#f87171', fontSize: '13px' }}>{error || 'No report yet.'}</p>
            <button
              onClick={fetchReport}
              style={{ marginTop: '10px', background: 'none', border: '1px solid rgba(0,170,255,0.3)', borderRadius: '8px', color: '#7dd4f8', padding: '8px 16px', cursor: 'pointer' }}
            >
              try again
            </button>
          </div>
        ) : (
          <>
            <div style={{
              padding: '12px 16px', borderRadius: '10px',
              border: `1px solid ${urgency.color}40`,
              background: `${urgency.color}0d`,
              marginBottom: '16px',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: urgency.color, flexShrink: 0, marginTop: '6px', boxShadow: `0 0 8px ${urgency.color}` }} />
              <div>
                <p style={{ fontSize: '10px', color: 'rgba(160,200,220,0.45)', margin: '0 0 2px', letterSpacing: '0.1em' }}>urgency</p>
                <p style={{ fontSize: '14px', color: urgency.color, margin: 0, letterSpacing: '0.06em' }}>{urgency.label}</p>
                {data.urgencyReason && (
                  <p style={{ fontSize: '12px', color: 'rgba(200,220,235,0.6)', margin: '4px 0 0', fontWeight: 300, lineHeight: 1.5 }}>{data.urgencyReason}</p>
                )}
              </div>
            </div>

            {data.redFlags?.length > 0 && (
              <div style={{
                padding: '12px 16px', borderRadius: '10px', marginBottom: '12px',
                border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.06)',
              }}>
                <p style={{ fontSize: '10px', color: '#f87171', margin: '0 0 8px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>warning signs mentioned</p>
                <BulletList items={data.redFlags} />
                <p style={{ fontSize: '12px', color: '#fca5a5', margin: '6px 0 0', fontWeight: 300 }}>
                  If these are severe, sudden, or getting worse, seek emergency care now.
                </p>
              </div>
            )}

            {data.summary && (
              <SectionCard label="summary">
                <p style={{ fontSize: '13px', color: '#bde0fa', fontWeight: 300, lineHeight: 1.65, margin: 0 }}>{data.summary}</p>
              </SectionCard>
            )}

            <SectionCard label="patient">
              <Row label="Age" value={intake?.age} />
              <Row label="Sex" value={intake?.biologicalSex} />
              {intake?.painOnset && <Row label="Onset" value={intake.painOnset} />}
              <Row label="Conditions" value={intake?.chronicConditions || 'None reported'} />
              <Row label="Medications" value={intake?.medications || 'None reported'} />
            </SectionCard>

            <SectionCard label={`pain regions · ${regionDetails.length}`}>
              {regionDetails.map((r, i) => (
                <div key={`${r.region}-${i}`} style={{
                  padding: '10px 0',
                  borderBottom: i < regionDetails.length - 1 ? '1px solid rgba(0,170,255,0.08)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 5px rgba(239,68,68,0.7)' }} />
                    <span style={{ fontSize: '14px', color: '#d4eeff', fontWeight: 400 }}>{r.region}</span>
                  </div>
                  <Row label="Started" value={r.onset} />
                  <Row label="Feels like" value={r.character} />
                  <Row label="Severity" value={r.severity} />
                  <Row label="Spreads to" value={r.radiation} />
                  <Row label="Worse with" value={r.aggravating} />
                  <Row label="Better with" value={r.relieving} />
                  <Row label="Other symptoms" value={r.associated} />
                </div>
              ))}
            </SectionCard>

            {data.considerations?.length > 0 && (
              <SectionCard label="possibilities for your clinician to consider">
                <BulletList items={data.considerations} />
              </SectionCard>
            )}

            {data.questionsForDoctor?.length > 0 && (
              <SectionCard label="questions to ask your doctor">
                <BulletList items={data.questionsForDoctor} />
              </SectionCard>
            )}

            {data.nextSteps?.length > 0 && (
              <SectionCard label="suggested next steps">
                <BulletList items={data.nextSteps} numbered />
              </SectionCard>
            )}

            <div style={{
              padding: '12px 14px', borderRadius: '8px',
              background: 'rgba(245,158,11,0.05)',
              border: '1px solid rgba(245,158,11,0.18)',
              fontSize: '12px', color: 'rgba(214,170,90,0.85)', lineHeight: '1.65',
              marginBottom: '20px', fontWeight: 300,
            }}>
              This report is AI-generated from your own description and is for informational purposes only. It is not medical advice, diagnosis, or treatment. Please consult a qualified healthcare professional.
            </div>

            <button
              onClick={downloadPdf}
              disabled={pdfState === 'working'}
              style={{
                width: '100%', padding: '14px',
                background: 'rgba(0,80,200,0.18)',
                border: '1px solid rgba(0,170,255,0.45)',
                borderRadius: '10px',
                color: '#7dd4f8', fontSize: '13px',
                letterSpacing: '0.08em',
                cursor: pdfState === 'working' ? 'wait' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {pdfState === 'working' ? 'preparing pdf…' : '↓ download pdf for your doctor'}
            </button>
            {pdfState === 'error' && (
              <p style={{ color: '#f87171', fontSize: '12px', textAlign: 'center' }}>Could not create the PDF. Please try again.</p>
            )}

            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', padding: '11px', marginTop: '10px',
                background: 'none',
                border: '1px solid rgba(0,170,255,0.12)',
                borderRadius: '10px',
                color: 'rgba(160,200,220,0.45)',
                fontSize: '12px', letterSpacing: '0.06em',
                cursor: 'pointer', fontWeight: 300,
              }}
            >
              start a new session
            </button>
          </>
        )}
      </div>
    </div>
  )
}
