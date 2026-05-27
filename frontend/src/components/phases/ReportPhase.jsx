'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSession, PHASES } from '@/contexts/SessionContext'
import { useVapi } from '@/contexts/VapiContext'

// PDF renderer is client-side only
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((m) => m.PDFDownloadLink),
  { ssr: false, loading: () => null }
)
const ReportDocument = dynamic(
  () => import('@/components/ui/ReportDocument'),
  { ssr: false }
)

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

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
        // Fallback assessment for demo
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
      background: '#040d1a',
      overflowY: 'auto',
      animation: 'fadeIn 0.5s ease forwards',
    }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#00aaff', fontFamily: 'monospace', letterSpacing: '0.25em', marginBottom: '6px' }}>
              ASSESSMENT COMPLETE
            </div>
            <div style={{ fontSize: '24px', color: '#e0f4ff', fontWeight: 300 }}>
              Pain Report
            </div>
          </div>
          <button
            onClick={() => setPhase(PHASES.CHAT)}
            style={{
              background: 'none', border: '1px solid rgba(0,170,255,0.25)',
              borderRadius: '8px', color: '#5a90b0', fontSize: '12px',
              fontFamily: 'monospace', cursor: 'pointer', padding: '8px 14px',
            }}
          >
            ← BACK
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{
              width: '40px', height: '40px', border: '2px solid rgba(0,208,255,0.2)',
              borderTop: '2px solid #00d0ff', borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }} />
            <div style={{ color: '#5a90b0', fontSize: '13px', fontFamily: 'monospace' }}>
              GENERATING ASSESSMENT...
            </div>
          </div>
        ) : (
          <>
            {/* Urgency badge */}
            <div style={{
              padding: '16px 20px', borderRadius: '10px',
              border: `1px solid ${urgencyColor}`,
              background: `${urgencyColor}15`,
              marginBottom: '24px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: urgencyColor, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '10px', color: '#5a90b0', fontFamily: 'monospace', marginBottom: '2px' }}>URGENCY LEVEL</div>
                <div style={{ fontSize: '15px', color: urgencyColor, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                  {assessment?.urgency?.toUpperCase() || 'UNKNOWN'}
                </div>
              </div>
            </div>

            {/* Patient summary */}
            <div style={{ background: '#060e1e', border: '1px solid rgba(0,170,255,0.15)', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#00aaff', fontFamily: 'monospace', letterSpacing: '0.15em', marginBottom: '12px' }}>
                PATIENT
              </div>
              {[
                ['Age', intake?.age],
                ['Sex', intake?.biologicalSex],
                ['Onset', intake?.painOnset],
                ['Conditions', intake?.chronicConditions],
                ['Medications', intake?.medications],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
                  <span style={{ width: '100px', fontSize: '12px', color: '#5a90b0', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: '12px', color: '#a0cce0' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Pain regions */}
            <div style={{ background: '#060e1e', border: '1px solid rgba(0,170,255,0.15)', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#00aaff', fontFamily: 'monospace', letterSpacing: '0.15em', marginBottom: '12px' }}>
                PAIN REGIONS ({painPoints.length})
              </div>
              {painPoints.map((p) => (
                <div key={p.region} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '6px 0', borderBottom: '1px solid rgba(0,170,255,0.08)',
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, boxShadow: '0 0 6px #ef4444' }} />
                  <span style={{ fontSize: '13px', color: '#c8e8ff', flex: 1 }}>{p.region}</span>
                  <span style={{ fontSize: '11px', color: '#5a90b0', fontFamily: 'monospace' }}>{p.severity}</span>
                </div>
              ))}
            </div>

            {/* Differentials */}
            {assessment?.differentials?.length > 0 && (
              <div style={{ background: '#060e1e', border: '1px solid rgba(0,170,255,0.15)', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#00aaff', fontFamily: 'monospace', letterSpacing: '0.15em', marginBottom: '12px' }}>
                  POSSIBLE CONSIDERATIONS
                </div>
                {assessment.differentials.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: '#00aaff', fontSize: '12px' }}>•</span>
                    <span style={{ fontSize: '13px', color: '#a0cce0' }}>{d}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Next steps */}
            {assessment?.nextSteps?.length > 0 && (
              <div style={{ background: '#060e1e', border: '1px solid rgba(0,170,255,0.15)', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', color: '#00aaff', fontFamily: 'monospace', letterSpacing: '0.15em', marginBottom: '12px' }}>
                  RECOMMENDED NEXT STEPS
                </div>
                {assessment.nextSteps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <span style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: 'rgba(0,170,255,0.15)', border: '1px solid rgba(0,170,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', color: '#00aaff', flexShrink: 0,
                      fontFamily: 'monospace',
                    }}>
                      {i+1}
                    </span>
                    <span style={{ fontSize: '13px', color: '#a0cce0', lineHeight: '1.5', paddingTop: '2px' }}>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div style={{
              padding: '12px 16px', borderRadius: '8px',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              fontSize: '12px', color: '#a08040', lineHeight: '1.6',
              marginBottom: '24px',
            }}>
              ⚠️ This report is AI-generated and for informational purposes only. It is not medical advice, diagnosis, or treatment. Please consult a qualified healthcare professional for any health concerns.
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
                fileName={`findmypain-report-${new Date().toISOString().slice(0,10)}.pdf`}
              >
                {({ loading: pdfLoading }) => (
                  <button style={{
                    width: '100%', padding: '16px',
                    background: 'linear-gradient(135deg, #0055cc, #0033aa)',
                    border: '1px solid #00aaff', borderRadius: '10px',
                    color: '#e0f4ff', fontSize: '14px',
                    fontFamily: 'monospace', letterSpacing: '0.1em',
                    cursor: 'pointer',
                    boxShadow: '0 0 24px rgba(0,85,204,0.4)',
                  }}>
                    {pdfLoading ? '⏳ PREPARING PDF...' : '⬇ DOWNLOAD PDF REPORT'}
                  </button>
                )}
              </PDFDownloadLink>
            )}

            {/* New session */}
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', padding: '12px', marginTop: '12px',
                background: 'none', border: '1px solid rgba(0,170,255,0.2)',
                borderRadius: '10px', color: '#5a90b0', fontSize: '13px',
                fontFamily: 'monospace', cursor: 'pointer',
              }}
            >
              START NEW SESSION
            </button>
          </>
        )}
      </div>
    </div>
  )
}
