'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSession, PHASES } from '@/contexts/SessionContext'
import { useVapi } from '@/contexts/VapiContext'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((m) => m.PDFDownloadLink),
  { ssr: false, loading: () => null }
)
const ReportDocument = dynamic(
  () => import('@/components/ui/ReportDocument'),
  { ssr: false }
)

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

function SectionCard({ label, children }) {
  return (
    <div style={{
      background: 'rgba(6,14,30,0.7)',
      border: '1px solid rgba(0,170,255,0.1)',
      borderRadius: '10px',
      padding: '16px 18px',
      marginBottom: '12px',
    }}>
      <p style={{
        fontSize: '10px', color: 'rgba(0,170,255,0.45)',
        letterSpacing: '0.15em', marginBottom: '12px', marginTop: 0,
        fontWeight: 400,
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}

export default function ReportPhase() {
  const { intake, painPoints, chatHistory, canvasScreenshot, assessment, setAssessment, sessionId, setPhase } = useSession()
  const { stopSession } = useVapi()
  const [loading, setLoading] = useState(!assessment)

  useEffect(() => {
    stopSession()
    if (!assessment) fetchAssessment()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAssessment = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/report/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (res.ok) {
        const data = await res.json()
        setAssessment(data.assessment)
      } else {
        setAssessment({
          urgency: 'moderate',
          differentials: ['Musculoskeletal strain', 'Nerve compression', 'Referred pain pattern'],
          nextSteps: [
            'Rest the affected area for 24-48 hours',
            'Apply ice for 15-20 minutes several times daily',
            'See a primary care physician within 1 week',
            'Keep a pain diary noting triggers and intensity changes',
          ],
        })
      }
    } catch {
      setAssessment({
        urgency: 'low',
        differentials: ['See a doctor for proper evaluation'],
        nextSteps: ['Consult a healthcare professional'],
      })
    } finally {
      setLoading(false)
    }
  }

  const urgencyColor = {
    low: '#22c55e', moderate: '#f59e0b', high: '#ef4444',
  }[assessment?.urgency] || '#00aaff'

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      background: '#030a16',
      overflowY: 'auto',
      animation: 'fadeIn 0.4s ease forwards',
    }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'rgba(0,170,255,0.4)', letterSpacing: '0.12em', marginBottom: '5px', marginTop: 0 }}>
              findmypain
            </p>
            <h1 style={{ fontSize: '22px', color: '#d4eeff', fontWeight: 300, margin: 0, letterSpacing: '-0.01em' }}>
              Pain Report
            </h1>
            <p style={{ fontSize: '12px', color: 'rgba(160,200,220,0.4)', margin: '4px 0 0', fontWeight: 300 }}>
              {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => setPhase(PHASES.CHAT)}
            style={{
              background: 'none', border: '1px solid rgba(0,170,255,0.12)',
              borderRadius: '6px', color: 'rgba(160,200,220,0.4)',
              fontSize: '11px', letterSpacing: '0.08em',
              cursor: 'pointer', padding: '6px 11px',
              transition: 'all 0.2s', marginTop: '4px',
            }}
          >
            ← back
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
            <p style={{ color: 'rgba(90,144,176,0.5)', fontSize: '13px', fontWeight: 300 }}>
              generating assessment...
            </p>
          </div>
        ) : (
          <>
            {/* Urgency */}
            <div style={{
              padding: '12px 16px', borderRadius: '10px',
              border: `1px solid ${urgencyColor}40`,
              background: `${urgencyColor}0d`,
              marginBottom: '20px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: urgencyColor, flexShrink: 0, boxShadow: `0 0 8px ${urgencyColor}` }} />
              <div>
                <p style={{ fontSize: '10px', color: 'rgba(160,200,220,0.4)', marginBottom: '1px', marginTop: 0, letterSpacing: '0.1em' }}>urgency</p>
                <p style={{ fontSize: '14px', color: urgencyColor, margin: 0, fontWeight: 400, letterSpacing: '0.06em' }}>
                  {assessment?.urgency || 'unknown'}
                </p>
              </div>
            </div>

            {/* Patient summary */}
            <SectionCard label="patient">
              {[
                ['Age', intake?.age],
                ['Sex', intake?.biologicalSex],
                ['Onset', intake?.painOnset],
                ['Conditions', intake?.chronicConditions],
                ['Medications', intake?.medications],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: '12px', marginBottom: '5px' }}>
                  <span style={{ width: '90px', fontSize: '12px', color: 'rgba(160,200,220,0.4)', flexShrink: 0, fontWeight: 300 }}>{label}</span>
                  <span style={{ fontSize: '12px', color: '#9dc8e4', fontWeight: 300 }}>{value}</span>
                </div>
              ))}
            </SectionCard>

            {/* Pain regions */}
            <SectionCard label={`pain regions · ${painPoints.length}`}>
              {painPoints.map((p) => (
                <div key={p.region} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '5px 0',
                  borderBottom: '1px solid rgba(0,170,255,0.06)',
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, boxShadow: '0 0 5px rgba(239,68,68,0.7)' }} />
                  <span style={{ fontSize: '13px', color: '#bde0fa', flex: 1, fontWeight: 300 }}>{p.region}</span>
                  <span style={{ fontSize: '11px', color: 'rgba(160,200,220,0.35)', fontWeight: 300 }}>{p.severity}</span>
                </div>
              ))}
            </SectionCard>

            {/* Differentials */}
            {assessment?.differentials?.length > 0 && (
              <SectionCard label="possible considerations">
                {assessment.differentials.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: 'rgba(0,170,255,0.4)', fontSize: '12px', marginTop: '1px' }}>·</span>
                    <span style={{ fontSize: '13px', color: '#9dc8e4', fontWeight: 300, lineHeight: '1.5' }}>{d}</span>
                  </div>
                ))}
              </SectionCard>
            )}

            {/* Next steps */}
            {assessment?.nextSteps?.length > 0 && (
              <SectionCard label="recommended next steps">
                {assessment.nextSteps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <span style={{
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: 'rgba(0,170,255,0.08)',
                      border: '1px solid rgba(0,170,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', color: 'rgba(0,170,255,0.6)', flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: '13px', color: '#9dc8e4', lineHeight: '1.55', paddingTop: '1px', fontWeight: 300 }}>{s}</span>
                  </div>
                ))}
              </SectionCard>
            )}

            {/* Disclaimer */}
            <div style={{
              padding: '12px 14px', borderRadius: '8px',
              background: 'rgba(245,158,11,0.05)',
              border: '1px solid rgba(245,158,11,0.15)',
              fontSize: '12px', color: 'rgba(180,140,60,0.7)', lineHeight: '1.65',
              marginBottom: '20px', fontWeight: 300,
            }}>
              ⚠ This report is AI-generated and for informational purposes only. It is not medical advice, diagnosis, or treatment. Please consult a qualified healthcare professional.
            </div>

            {/* PDF download */}
            {ReportDocument && PDFDownloadLink && (
              <PDFDownloadLink
                document={
                  <ReportDocument
                    intake={intake}
                    painPoints={painPoints}
                    chatHistory={chatHistory}
                    assessment={assessment}
                    canvasScreenshot={canvasScreenshot}
                  />
                }
                fileName={`findmypain-${new Date().toISOString().slice(0,10)}.pdf`}
              >
                {({ loading: pdfLoading }) => (
                  <button style={{
                    width: '100%', padding: '14px',
                    background: 'rgba(0,80,200,0.15)',
                    border: '1px solid rgba(0,170,255,0.4)',
                    borderRadius: '10px',
                    color: '#7dd4f8', fontSize: '13px',
                    letterSpacing: '0.08em',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}>
                    {pdfLoading ? 'preparing pdf...' : '↓ download pdf report'}
                  </button>
                )}
              </PDFDownloadLink>
            )}

            {/* New session */}
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', padding: '11px', marginTop: '10px',
                background: 'none',
                border: '1px solid rgba(0,170,255,0.1)',
                borderRadius: '10px',
                color: 'rgba(160,200,220,0.35)',
                fontSize: '12px', letterSpacing: '0.06em',
                cursor: 'pointer', fontWeight: 300,
              }}
            >
              start new session
            </button>
          </>
        )}
      </div>
    </div>
  )
}
