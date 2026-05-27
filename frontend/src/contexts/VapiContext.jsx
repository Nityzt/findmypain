'use client'

import { createContext, useContext, useRef, useState, useCallback } from 'react'

const VapiContext = createContext(null)

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

function buildSystemPrompt(intake, painPoints) {
  const pts = painPoints.map((p) => `${p.region} (${p.severity})`).join(', ') || 'none selected yet'
  return `You are a warm, friendly medical intake assistant for FindMyPain.
Your voice is calm and reassuring — think of yourself as a knowledgeable friend, not a clinical robot.

Patient info: ${intake.age ? `${intake.age} years old` : 'age unknown'}, ${intake.biologicalSex || 'sex unknown'}.
${intake.chronicConditions ? `Chronic conditions: ${intake.chronicConditions}.` : ''}
${intake.medications ? `Current medications: ${intake.medications}.` : ''}
${intake.painOnset ? `Pain onset type: ${intake.painOnset}.` : ''}

Selected pain regions: ${pts}.

Your role:
- Ask ONE focused follow-up question at a time about the pain
- Cover: duration, severity (1-10), radiation patterns, triggers, associated symptoms (nausea, numbness, etc.)
- After 4-5 exchanges, wrap up and say you are ready to generate the report
- NEVER diagnose. Always say "I'd recommend speaking with a doctor about this."
- Be brief — keep responses under 2 sentences
- When you have enough info, end your response with: "I think I have enough to generate your report."

Start by briefly acknowledging the pain regions selected and asking the most important first question.`
}

const INTRO_MESSAGE =
  "Hi, I'm here to find your pain — select your pain points by clicking on the body and I'll ask you a few questions."

export function VapiProvider({ children }) {
  const vapiRef   = useRef(null)
  const activeRef = useRef(false) // prevent duplicate sessions

  const [isSpeaking,   setIsSpeaking]   = useState(false)
  const [isListening,  setIsListening]  = useState(false)
  const [isConnected,  setIsConnected]  = useState(false)
  const [hasVapi,      setHasVapi]      = useState(false)
  const [transcript,   setTranscript]   = useState('')
  // Last completed utterance from either side — ChatPanel subscribes to sync chat history
  const [lastMessage,  setLastMessage]  = useState(null) // { role: 'user'|'assistant', content }

  // Lazily load the Vapi SDK — returns null if no API key configured
  const getVapi = useCallback(async () => {
    if (vapiRef.current) return vapiRef.current
    const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY || ''
    if (!apiKey) return null
    const { default: Vapi } = await import('@vapi-ai/web')
    const instance = new Vapi(apiKey)
    vapiRef.current = instance
    return instance
  }, [])

  // Re-attach listeners before each session (cleans up stale handlers)
  const attachEvents = useCallback((vapi) => {
    vapi.removeAllListeners?.()
    vapi.on('speech-start', () => setIsSpeaking(true))
    vapi.on('speech-end',   () => setIsSpeaking(false))
    vapi.on('call-start',   () => { setIsConnected(true); setIsListening(true); setHasVapi(true) })
    vapi.on('call-end',     () => {
      setIsConnected(false); setIsListening(false); setIsSpeaking(false)
      activeRef.current = false
    })
    vapi.on('error', (err) => {
      console.warn('[Vapi] session error:', err?.message || err)
      setIsConnected(false); setIsListening(false); setIsSpeaking(false)
      activeRef.current = false
    })
    vapi.on('message', (msg) => {
      if (msg.type === 'transcript' && msg.transcriptType === 'final') {
        setTranscript(msg.transcript)
        // Broadcast completed utterances so ChatPanel can add them to history
        if (msg.role === 'user' || msg.role === 'assistant') {
          setLastMessage({ role: msg.role, content: msg.transcript })
        }
      }
    })
  }, [])

  const startSession = useCallback(async ({ intake = {}, painPoints = [], isIntro = false } = {}) => {
    if (activeRef.current) return   // already in a session
    const vapi = await getVapi()
    if (!vapi) {
      console.info('[Vapi] No API key — text-only mode.')
      return
    }

    // Fully stop any prior call and wait a tick so call-end events settle
    try { vapi.stop() } catch (_) {}
    await new Promise(r => setTimeout(r, 300))

    activeRef.current = true
    attachEvents(vapi)

    const systemPrompt = isIntro
      ? `You are a warm medical intake assistant for FindMyPain.
Say exactly this opening and nothing else: "${INTRO_MESSAGE}"
Do not ask any follow-up questions yet.`
      : buildSystemPrompt(intake, painPoints)

    try {
      await vapi.start({
        name: 'FindMyPain AI',
        // firstMessage tells Vapi to speak this immediately without waiting for user input
        firstMessage: isIntro ? INTRO_MESSAGE : undefined,
        transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en-US' },
        model: {
          provider: 'anthropic',
          // Valid Vapi model IDs for Anthropic — haiku-4-5 is not recognized by Vapi
          model: 'claude-3-5-haiku-20241022',
          messages: [{ role: 'system', content: systemPrompt }],
          maxTokens: isIntro ? 60 : 200,
          temperature: 0.4,
        },
        voice: {
          provider: '11labs',
          voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
        },
      })
    } catch (err) {
      console.warn('[Vapi] Could not start session:', err?.message || err)
      activeRef.current = false
    }
  }, [getVapi, attachEvents])

  const stopSession = useCallback(() => {
    const vapi = vapiRef.current
    if (vapi) try { vapi.stop() } catch (_) {}
    setIsConnected(false); setIsSpeaking(false); setIsListening(false)
    activeRef.current = false
  }, [])

  const sendMessage = useCallback(async (text) => {
    const vapi = vapiRef.current
    if (vapi && isConnected) {
      vapi.send({ type: 'add-message', message: { role: 'user', content: text } })
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      return res.ok ? res.json() : null
    } catch {
      return null
    }
  }, [isConnected])

  return (
    <VapiContext.Provider value={{
      isSpeaking, isListening, isConnected, hasVapi, transcript, lastMessage,
      startSession, stopSession, sendMessage,
      introMessage: INTRO_MESSAGE,
    }}>
      {children}
    </VapiContext.Provider>
  )
}

export function useVapi() {
  const ctx = useContext(VapiContext)
  if (!ctx) throw new Error('useVapi must be used inside VapiProvider')
  return ctx
}
