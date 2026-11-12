'use client'

import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { interviewerPrompt } from '@/lib/intake'

const VapiContext = createContext(null)

const INTRO_MESSAGE =
  "Hi, I'm here to help you find your pain. Tap to begin, mark where it hurts on the body, and I'll ask you a few questions."

// By default the voice agent keeps the LLM configured on the Vapi dashboard
// assistant, and the patient context is injected into the call. To have the
// app pick the model instead, set NEXT_PUBLIC_VAPI_MODEL to "provider:model",
// e.g. "google:gemini-3.5-flash". If Vapi rejects that override the call is
// retried with the dashboard model.
function getModelOverride() {
  const raw = process.env.NEXT_PUBLIC_VAPI_MODEL || ''
  const i = raw.indexOf(':')
  if (i <= 0) return null
  return { provider: raw.slice(0, i), model: raw.slice(i + 1), temperature: 0.4 }
}

// Without a dashboard assistant there is no configured model, so one is required.
const INLINE_DEFAULT_MODEL = { provider: 'google', model: 'gemini-2.5-flash', temperature: 0.4 }

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

function openingLine(painPoints, history) {
  if (history.length) {
    return "Welcome back. Let's pick up where we left off — is there anything you'd like to add?"
  }
  const regions = painPoints.map((p) => p.region.toLowerCase())
  const list = regions.length > 1
    ? `${regions.slice(0, -1).join(', ')} and ${regions[regions.length - 1]}`
    : regions[0] || 'the areas you marked'
  return `Thanks. I can see you've marked your ${list}. Let's start there — when did the pain first begin?`
}

/**
 * Returns the Vapi assistantOverrides for a call, plus the system context to
 * inject once the call is up (used when the dashboard model is kept).
 */
function buildCall(mode, intake, painPoints, history, modelOverride) {
  if (mode === 'intro') {
    const context = 'You are the FindMyPain greeter and have already greeted the user. If they speak, reply only with: "Tap the screen when you are ready to begin." Do not ask questions.'
    return {
      context,
      overrides: {
        firstMessage: INTRO_MESSAGE,
        firstMessageMode: 'assistant-speaks-first',
        maxDurationSeconds: 60,
        ...(modelOverride && { model: { ...modelOverride, maxTokens: 60, messages: [{ role: 'system', content: context }] } }),
      },
    }
  }

  const firstMessage = openingLine(painPoints, history)
  let context = interviewerPrompt(intake, painPoints)
  if (history.length) {
    const transcript = history
      .map((m) => `${m.role === 'user' ? 'Patient' : 'You'}: ${m.content}`)
      .join('\n')
    context += `\n\nConversation so far (the patient stepped away and came back):\n${transcript}\n\nContinue from here. Do not repeat questions that were already answered.`
  }
  context += `\n\nYou have already said: "${firstMessage}" Wait for the patient's answer, then continue the interview.`

  return {
    context,
    overrides: {
      firstMessage,
      firstMessageMode: 'assistant-speaks-first',
      maxDurationSeconds: 900,
      // Available to {{placeholders}} in the dashboard assistant's prompt.
      variableValues: {
        regions: painPoints.map((p) => p.region).join(', '),
        age: intake.age || '',
        biologicalSex: intake.biologicalSex || '',
        painOnset: intake.painOnset || '',
        conditions: intake.chronicConditions || '',
        medications: intake.medications || '',
      },
      ...(modelOverride && { model: { ...modelOverride, maxTokens: 250, messages: [{ role: 'system', content: context }] } }),
    },
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
  const startingRef = useRef(false)     // vapi.start() in flight: start handles errors
  const pendingContextRef = useRef(null) // system context to inject on call-start
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
      // Keep the dashboard model, but give it this session's patient context.
      if (pendingContextRef.current) {
        vapi.send({
          type: 'add-message',
          message: { role: 'system', content: pendingContextRef.current },
          triggerResponseEnabled: false,
        })
        pendingContextRef.current = null
      }
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
      if (startingRef.current) return // startSession decides whether to retry
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

    const assistantId = getVapiAssistantId()
    const modelOverride = getModelOverride() || (assistantId ? null : INLINE_DEFAULT_MODEL)

    const attempt = async (withModel) => {
      const { overrides, context } = buildCall(nextMode, intake, painPoints, history, withModel)
      pendingContextRef.current = overrides.model ? null : context
      return assistantId
        ? vapi.start(assistantId, overrides)
        : vapi.start({ name: 'FindMyPain', ...INLINE_VOICE, ...overrides })
    }

    let failure = null
    startingRef.current = true
    try {
      let call = await attempt(modelOverride)
      // A model Vapi rejects shouldn't cost the patient their voice session.
      if (!call && modelOverride && assistantId && id === sessionIdRef.current) {
        console.warn('[Vapi] model override rejected, retrying with the dashboard model')
        call = await attempt(null)
      }
      if (!call) failure = 'Could not start the voice assistant.'
    } catch (err) {
      console.warn('[Vapi] Could not start session:', err)
      failure = errorText(err)
    } finally {
      startingRef.current = false
    }

    if (id !== sessionIdRef.current) return false
    if (failure) {
      pendingContextRef.current = null
      setVoiceError(failure)
      if (nextMode === 'intro') setIntroDone(true)
      resetCallState()
      return false
    }
    return true
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
