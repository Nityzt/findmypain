'use client'

import { useEffect } from 'react'
import { useVapi } from '@/contexts/VapiContext'
import ChatPanel from '@/components/ui/ChatPanel'

export default function ChatPhase({ onReadyForReport }) {
  const { stopSession } = useVapi()

  // Leaving the chat (back, or on to the report) always ends the voice call.
  useEffect(() => () => stopSession(), [stopSession])

  return <ChatPanel onReadyForReport={onReadyForReport} />
}
