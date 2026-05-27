'use client'

import { useEffect } from 'react'
import { useSession, PHASES } from '@/contexts/SessionContext'
import { useVapi } from '@/contexts/VapiContext'
import ChatPanel from '@/components/ui/ChatPanel'

export default function ChatPhase() {
  const { intake, painPoints, setPhase } = useSession()
  const { startSession } = useVapi()

  // Start Vapi conversation session when entering chat phase
  useEffect(() => {
    startSession({ intake, painPoints, isIntro: false })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.5s cubic-bezier(0.4,0,0.2,1) forwards',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid rgba(0,170,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(4,13,26,0.95)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#00aaff', fontFamily: 'monospace', letterSpacing: '0.2em' }}>
            PAIN ASSESSMENT
          </div>
          <div style={{ fontSize: '13px', color: '#a0cce0', marginTop: '2px' }}>
            Speak or type your answers
          </div>
        </div>
        <button
          onClick={() => setPhase(PHASES.PAIN_SELECT)}
          style={{
            background: 'none', border: '1px solid rgba(0,170,255,0.2)',
            borderRadius: '6px', color: '#5a90b0', fontSize: '12px',
            fontFamily: 'monospace', cursor: 'pointer', padding: '5px 10px',
          }}
        >
          ← BACK
        </button>
      </div>

      {/* Chat panel fills remaining space */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatPanel onReadyForReport={() => setPhase(PHASES.REPORT)} />
      </div>
    </div>
  )
}
