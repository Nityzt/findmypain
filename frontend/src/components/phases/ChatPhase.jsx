'use client'

import { useEffect } from 'react'
import { useSession, PHASES } from '@/contexts/SessionContext'
import { useVapi } from '@/contexts/VapiContext'
import ChatPanel from '@/components/ui/ChatPanel'

export default function ChatPhase() {
  const { intake, painPoints, setPhase } = useSession()
  const { startSession } = useVapi()

  useEffect(() => {
    startSession({ intake, painPoints, isIntro: false })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Minimal back button — top left only */}
      <button
        onClick={() => setPhase(PHASES.PAIN_SELECT)}
        style={{
          position: 'absolute', top: '14px', right: '14px', zIndex: 11,
          background: 'none',
          border: '1px solid rgba(0,170,255,0.12)',
          borderRadius: '6px',
          color: 'rgba(160,200,220,0.4)',
          fontSize: '11px', letterSpacing: '0.1em',
          cursor: 'pointer', padding: '5px 10px',
          backdropFilter: 'blur(4px)',
          transition: 'all 0.2s',
        }}
      >
        ← back
      </button>

      {/* Chat panel fills the space */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatPanel onReadyForReport={() => setPhase(PHASES.REPORT)} />
      </div>
    </div>
  )
}
