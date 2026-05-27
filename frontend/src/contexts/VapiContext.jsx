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

  const [isSpeaking,  setIsSpeaking]  = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [hasVapi,     setHasVapi]     = useState(false)
  const [transcript,  setTranscript]  = useState('')

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

    try { vapi.stop() } catch (_) {}
    activeRef.current = true
    attachEvents(vapi)

    const systemPrompt = isIntro
      ? `You are a friendly medical intake assistant for FindMyPain.
         Say exactly this one sentence and nothing else: "${INTRO_MESSAGE}"`
      : buildSystemPrompt(intake, painPoints)

    try {
      await vapi.start({
        name: 'FindMyPain AI',
        firstMessage: isIntro ? INTRO_MESSAGE : undefined,
        transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en-US' },
        model: {
          provider: 'anthropic',
          model: 'claude-haiku-4-5-20251001',
          messages: [{ role: 'system', content: systemPrompt }],
          maxTokens: 150,
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
      isSpeaking, isListening, isConnected, hasVapi, transcript,
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
