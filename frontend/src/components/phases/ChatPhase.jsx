'use client'

import { useEffect } from 'react'
import { useSession, PHASES } from '@/contexts/SessionContext'
import { useVapi } from '@/contexts/VapiContext'
import ChatPanel from '@/components/ui/ChatPanel'

export default function ChatPhase({ onReadyForReport }) {
  const { setPhase } = useSession()
  const { stopSession } = useVapi()

  // Leaving the chat (back, or on to the report) always ends the voice call.
  useEffect(() => () => stopSession(), [stopSession])

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex', flexDirection: 'column',
    }}>
      <button
        onClick={() => setPhase(PHASES.PAIN_SELECT)}
        title="Back to marking pain regions"
        style={{
          position: 'absolute', top: '12px', right: '14px', zIndex: 11,
          background: 'rgba(3,10,22,0.8)',
          border: '1px solid rgba(0,170,255,0.18)',
          borderRadius: '6px',
          color: 'rgba(160,200,220,0.6)',
          fontSize: '11px', letterSpacing: '0.1em',
          cursor: 'pointer', padding: '5px 10px',
          backdropFilter: 'blur(4px)',
          transition: 'all 0.2s',
        }}
      >
        ← edit regions
      </button>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatPanel onReadyForReport={onReadyForReport} />
      </div>
    </div>
  )
}
