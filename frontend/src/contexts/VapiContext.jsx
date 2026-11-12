'use client'

import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { interviewerPrompt } from '@/lib/intake'

const VapiContext = createContext(null)

const INTRO_MESSAGE =
  "Hi, I'm here to help you find your pain. Tap to begin, mark where it hurts on the body, and I'll ask you a few questions."

// Vapi runs the LLM turn itself. Haiku is used for the spoken agent because
// time-to-first-word matters more than depth here; reasoningEffort unset = off.
const VOICE_MODEL = { provider: 'anthropic', model: 'claude-haiku-5-5', temperature: 0.4 }

// Fallback voice settings, used only when no dashboard assistant ID is configured.
const INLINE_VOICE = {
  transcriber: { provider: 'deepgram', model: 'nova-3', language: 'en' },
  voice: { provider: '11labs', voiceId: '21m00Tcm4TlvDq8ikWAM' },
}

function getVapiPublicKey() {
  return process.env.NEXT_PUBLIC_VAPI_API_KEY || process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || ''
}

function getVapiAssistantId() {
  return process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || ''
}

export const hasVoiceConfig = () => Boolean(getVapiPublicKey())

function errorText(err) {
  if (!err) return 'Voice session failed.'
  if (typeof err === 'string') return err
  return (
    err.error?.message?.msg || err.error?.message || err.errorMsg || err.message ||
    err.error?.msg || 'Voice session failed.'
  )
}

function buildOverrides(mode, intake, painPoints, history) {
  if (mode === 'intro') {
    return {
      firstMessage: INTRO_MESSAGE,
      firstMessageMode: 'assistant-speaks-first',
      maxDurationSeconds: 60,
      model: {
        ...VOICE_MODEL,
        maxTokens: 60,
        messages: [{
          role: 'system',
          content: 'You are the FindMyPain greeter. You have already greeted the user. If they speak, reply only with: "Tap the screen when you are ready to begin." Do not ask questions.',
        }],
      },
    }
  }

  let system = interviewerPrompt(intake, painPoints)
  if (history.length) {
    const transcript = history
      .map((m) => `${m.role === 'user' ? 'Patient' : 'You'}: ${m.content}`)
      .join('\n')
    system += `\n\nConversation so far (the patient stepped away and came back):\n${transcript}\n\nContinue from here. Do not repeat questions that were already answered. Start by briefly welcoming them back.`
  } else {
    system += '\n\nStart by briefly acknowledging the regions they marked and asking your first question.'
  }

  return {
    firstMessageMode: 'assistant-speaks-first-with-model-generated-message',
    maxDurationSeconds: 900,
    model: { ...VOICE_MODEL, maxTokens: 250, messages: [{ role: 'system', content: system }] },
  }
}

export function VapiProvider({ children }) {
  const { appendTranscript } = useSession()
  const vapiRef = useRef(null)
  const activeRef = useRef(false)       // a call is starting or running
  const modeRef = useRef(null)          // 'intro' | 'interview'
  const sessionIdRef = useRef(0)        // ignore results from superseded starts
  const stoppingRef = useRef(null)      // in-flight vapi.stop() promise
  const introTimerRef = useRef(null)
  const appendRef = useRef(appendTranscript)
  const stopRef = useRef(() => {})
  useEffect(() => { appendRef.current = appendTranscript }, [appendTranscript])

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [mode, setMode] = useState(null)
  const [introDone, setIntroDone] = useState(false)
  const [micPermission, setMicPermission] = useState('prompt')
  const [voiceError, setVoiceError] = useState('')

  const resetCallState = useCallback(() => {
    activeRef.current = false
    modeRef.current = null
    setMode(null)
    setIsConnected(false)
    setIsConnecting(false)
    setIsListening(false)
    setIsSpeaking(false)
  }, [])

  const requestMicrophone = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicPermission('unsupported')
      setVoiceError('Microphone access is not supported in this browser. You can type instead.')
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setMicPermission('granted')
      return true
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
      setMicPermission(denied ? 'denied' : 'error')
      setVoiceError(
        denied
          ? 'Microphone access was blocked. Allow it in your browser settings, or type instead.'
          : 'Could not access your microphone. Check your input device, or type instead.'
      )
      return false
    }
  }, [])

  const getVapi = useCallback(async () => {
    if (vapiRef.current) return vapiRef.current
    const apiKey = getVapiPublicKey()
    if (!apiKey) return null
    const { default: Vapi } = await import('@vapi-ai/web')
    const vapi = new Vapi(apiKey)

    // Listeners are attached once; sessionIdRef filters out late events
    // from a call that has already been replaced.
    vapi.on('call-start', () => {
      setIsConnecting(false)
      setIsConnected(true)
      setIsListening(true)
    })
    vapi.on('call-end', () => {
      if (modeRef.current === 'intro') setIntroDone(true)
      resetCallState()
    })
    vapi.on('speech-start', () => {
      clearTimeout(introTimerRef.current)
      setIsSpeaking(true)
      setIsListening(false)
    })
    vapi.on('speech-end', () => {
      setIsSpeaking(false)
      if (!activeRef.current) return
      setIsListening(true)
      // The intro is a one-line greeting: hang up once it has been spoken.
      // The delay keeps a short pause mid-sentence from cutting it off.
      if (modeRef.current === 'intro') {
        clearTimeout(introTimerRef.current)
        introTimerRef.current = setTimeout(() => {
          if (modeRef.current !== 'intro') return
          setIntroDone(true)
          stopRef.current()
        }, 1500)
      }
    })
    vapi.on('error', (err) => {
      console.warn('[Vapi] session error:', err)
      setVoiceError(errorText(err))
      if (modeRef.current === 'intro') setIntroDone(true)
      resetCallState()
    })
    vapi.on('message', (msg) => {
      if (modeRef.current !== 'interview') return
      if (msg?.type === 'transcript' && msg.transcriptType === 'final' &&
          (msg.role === 'user' || msg.role === 'assistant')) {
        appendRef.current(msg.role, msg.transcript)
      }
    })

    vapiRef.current = vapi
    return vapi
  }, [resetCallState])

  /**
   * Starts a voice call. Returns true when the call is starting, false when voice
   * is unavailable (no key, no mic, start failure) so callers can fall back to text.
   */
  const startSession = useCallback(async ({ mode: nextMode = 'interview', intake = {}, painPoints = [], history = [] } = {}) => {
    if (activeRef.current && modeRef.current === nextMode) return true
    setVoiceError('')

    if (!getVapiPublicKey()) {
      if (nextMode === 'intro') setIntroDone(true)
      return false
    }

    const hasMic = await requestMicrophone()
    if (!hasMic) {
      if (nextMode === 'intro') setIntroDone(true)
      return false
    }

    const vapi = await getVapi()
    if (activeRef.current) stopRef.current()
    // Let a previous call finish ending, so its call-end can't reset this one.
    if (stoppingRef.current) await stoppingRef.current

    const id = ++sessionIdRef.current
    activeRef.current = true
    modeRef.current = nextMode
    setMode(nextMode)
    setIsConnecting(true)

    const overrides = buildOverrides(nextMode, intake, painPoints, history)
    const assistantId = getVapiAssistantId()

    try {
      const call = assistantId
        ? await vapi.start(assistantId, overrides)
        : await vapi.start({ name: 'FindMyPain', ...INLINE_VOICE, ...overrides })
      if (id !== sessionIdRef.current) return false
      if (!call) {
        // start() resolves null after reporting the failure on the error event
        resetCallState()
        return false
      }
      return true
    } catch (err) {
      console.warn('[Vapi] Could not start session:', err)
      if (id === sessionIdRef.current) {
        setVoiceError(errorText(err))
        if (nextMode === 'intro') setIntroDone(true)
        resetCallState()
      }
      return false
    }
  }, [getVapi, requestMicrophone, resetCallState])

  const stopSession = useCallback(() => {
    sessionIdRef.current++
    clearTimeout(introTimerRef.current)
    const vapi = vapiRef.current
    const wasActive = activeRef.current
    resetCallState()
    if (vapi && wasActive) {
      const p = vapi.stop().catch(() => {}).finally(() => {
        if (stoppingRef.current === p) stoppingRef.current = null
      })
      stoppingRef.current = p
    }
  }, [resetCallState])
  useEffect(() => { stopRef.current = stopSession }, [stopSession])

  /** Sends a typed message into the live call; the agent answers by voice. */
  const sendToCall = useCallback((text) => {
    const vapi = vapiRef.current
    if (!vapi || !isConnected || modeRef.current !== 'interview') return false
    vapi.send({ type: 'add-message', message: { role: 'user', content: text } })
    return true
  }, [isConnected])

  // Hang up if the page is closed mid-call.
  useEffect(() => {
    const onUnload = () => { try { vapiRef.current?.stop() } catch { /* ignore */ } }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  return (
    <VapiContext.Provider value={{
      isSpeaking, isListening, isConnected, isConnecting, mode, introDone,
      micPermission, voiceError, setVoiceError,
      hasVoice: hasVoiceConfig(),
      startSession, stopSession, sendToCall,
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
