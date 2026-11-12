'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useVapi } from '@/contexts/VapiContext'
import { useSession } from '@/contexts/SessionContext'
import PainPointChip from './PainPointChip'

const READY_PATTERN = /enough to generate (your|the) report/i
const MIN_ANSWERS_FOR_REPORT = 2

async function requestReply(intake, painPoints, history) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intake,
      painPoints: painPoints.map((p) => ({ region: p.region })),
      history: history.map(({ role, content }) => ({ role, content })),
    }),
  })
  if (!res.ok) throw new Error(`chat request failed: ${res.status}`)
  return res.json()
}

export default function ChatPanel({ onReadyForReport }) {
  const { intake, painPoints, chatHistory, addMessage } = useSession()
  const {
    isSpeaking, isListening, isConnected, isConnecting, mode, hasVoice,
    startSession, stopSession, sendToCall, voiceError, setVoiceError,
  } = useVapi()
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [textError, setTextError] = useState('')
  const [apiReady, setApiReady] = useState(false)
  const messagesEndRef = useRef(null)
  const historyRef = useRef(chatHistory)
  useEffect(() => { historyRef.current = chatHistory }, [chatHistory])

  const inCall = isConnected && mode === 'interview'
  const answers = chatHistory.filter((m) => m.role === 'user').length

  // Text mode: ask the server for the next question (or the opening one).
  const fetchReply = useCallback(async (history) => {
    setIsTyping(true)
    setTextError('')
    try {
      const data = await requestReply(intake, painPoints, history)
      addMessage('assistant', data.reply)
      if (data.readyForReport) setApiReady(true)
    } catch (err) {
      console.warn('[Chat] reply failed', err)
      setTextError('Could not reach the assistant. Check your connection and try again.')
    } finally {
      setIsTyping(false)
    }
  }, [intake, painPoints, addMessage])

  const startVoiceOrText = useCallback(async () => {
    const started = await startSession({
      mode: 'interview', intake, painPoints,
      history: historyRef.current.map(({ role, content }) => ({ role, content })),
    })
    if (!started && !historyRef.current.some((m) => m.role === 'assistant')) {
      fetchReply(historyRef.current)
    }
  }, [startSession, intake, painPoints, fetchReply])

  // On entering the chat: try voice, fall back to text.
  useEffect(() => {
    startVoiceOrText()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The agent signals it has enough detail by ending its latest turn with a
  // fixed closing phrase. Ignore a closing line that was already there when the
  // chat was (re)opened, so "add more detail" doesn't bounce straight back.
  const [initialLast] = useState(() => chatHistory[chatHistory.length - 1]?.content)
  const lastMsg = chatHistory[chatHistory.length - 1]
  const phraseReady = lastMsg?.role === 'assistant' && lastMsg.content !== initialLast &&
    READY_PATTERN.test(lastMsg.content)
  const readyPending = apiReady || phraseReady

  // A voice call that fails after starting should not leave an empty chat.
  useEffect(() => {
    if (voiceError && !inCall && !isConnecting && !isTyping &&
        !historyRef.current.some((m) => m.role === 'assistant')) {
      fetchReply(historyRef.current)
    }
  }, [voiceError, inCall, isConnecting]) // eslint-disable-line react-hooks/exhaustive-deps

  // Move on to the report once the agent has finished speaking its last line.
  useEffect(() => {
    if (!readyPending || isSpeaking) return
    const t = setTimeout(() => onReadyForReport?.(), 1500)
    return () => clearTimeout(t)
  }, [readyPending, isSpeaking, onReadyForReport])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [chatHistory, isTyping])

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || isTyping) return
    setInputText('')
    setApiReady(false)
    addMessage('user', text)
    if (sendToCall(text)) return // the voice agent answers out loud
    await fetchReply([...historyRef.current, { role: 'user', content: text }])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleMicClick = () => {
    if (inCall || isConnecting) {
      stopSession()
      return
    }
    setVoiceError('')
    startVoiceOrText()
  }

  const status = isConnecting ? 'connecting voice…'
    : inCall ? (isSpeaking ? 'assistant speaking…' : isListening ? 'listening — just talk' : 'voice on')
    : hasVoice ? 'voice off — type, or tap the mic to talk' : 'type your answers'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(3,10,22,0.92)',
      borderLeft: '1px solid rgba(0,170,255,0.1)',
    }}>
      {painPoints.length > 0 && (
        <div style={{
          padding: '10px 130px 8px 14px',
          borderBottom: '1px solid rgba(0,170,255,0.08)',
          display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
          minHeight: '46px',
        }}>
          {painPoints.map((p) => (
            <PainPointChip key={p.region} region={p.region} />
          ))}
        </div>
      )}

      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 14px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        minHeight: '180px',
      }}>
        {chatHistory.length === 0 && (
          <div style={{
            textAlign: 'center', color: 'rgba(90,144,176,0.5)', fontSize: '13px',
            marginTop: '28px', fontStyle: 'italic', fontWeight: 300,
          }}>
            {isConnecting ? 'connecting to your assistant…' : 'starting your assessment…'}
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '82%',
              padding: '9px 13px',
              borderRadius: msg.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
              background: msg.role === 'user' ? 'rgba(0,60,140,0.3)' : 'rgba(0,20,50,0.5)',
              border: msg.role === 'user' ? '1px solid rgba(0,170,255,0.2)' : '1px solid rgba(0,170,255,0.08)',
              color: msg.role === 'user' ? '#bde0fa' : '#8fc4de',
              fontSize: '14px', lineHeight: '1.55', fontWeight: 300,
              overflowWrap: 'anywhere',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex', gap: '5px', padding: '6px 2px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#00aaff', opacity: 0.5,
                animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        )}

        {textError && (
          <div style={{ fontSize: '12px', color: '#f87171' }}>
            {textError}{' '}
            <button
              onClick={() => fetchReply(historyRef.current)}
              style={{ background: 'none', border: 'none', color: '#7dd4f8', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '12px' }}
            >
              retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {(answers >= MIN_ANSWERS_FOR_REPORT || readyPending) && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(0,170,255,0.08)' }}>
          <button
            onClick={() => onReadyForReport?.()}
            style={{
              width: '100%', padding: '11px',
              background: readyPending ? 'rgba(0,100,220,0.25)' : 'rgba(0,60,160,0.12)',
              border: `1px solid ${readyPending ? 'rgba(0,170,255,0.6)' : 'rgba(0,170,255,0.3)'}`,
              borderRadius: '8px',
              color: '#7dd4f8', fontSize: '12px', letterSpacing: '0.08em',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {readyPending ? 'preparing your report…' : "i'm done — generate report →"}
          </button>
        </div>
      )}

      <div style={{
        padding: '6px 16px 0', fontSize: '10px', letterSpacing: '0.1em',
        color: inCall ? 'rgba(0,208,255,0.6)' : 'rgba(160,200,220,0.4)',
        fontFamily: 'monospace',
      }}>
        {status}
      </div>

      <div style={{
        padding: '8px 14px 14px',
        display: 'flex', gap: '8px', alignItems: 'center',
      }}>
        {hasVoice && (
          <button
            type="button"
            onClick={handleMicClick}
            title={inCall || isConnecting ? 'Turn voice off' : 'Talk to the assistant'}
            aria-label={inCall || isConnecting ? 'Turn voice off' : 'Talk to the assistant'}
            style={{
              width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
              background: inCall ? 'rgba(0,208,255,0.14)' : 'rgba(0,170,255,0.06)',
              border: `1px solid ${inCall ? '#00d0ff' : 'rgba(0,170,255,0.25)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isListening && inCall ? '0 0 10px rgba(0,208,255,0.45)' : 'none',
              animation: isListening && inCall ? 'pulse 1.5s ease-in-out infinite' : 'none',
              cursor: 'pointer', padding: 0, color: '#7dd4f8',
            }}
          >
            {inCall || isConnecting ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            )}
          </button>
        )}

        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={inCall ? 'or type here…' : 'type your answer'}
          aria-label="Your answer"
          style={{
            flex: 1, minWidth: 0, padding: '9px 12px',
            background: 'rgba(0,12,28,0.5)',
            border: '1px solid rgba(0,170,255,0.15)',
            borderRadius: '8px',
            color: '#c8e8ff', fontSize: '16px',
            outline: 'none', fontWeight: 300,
          }}
        />

        <button
          onClick={handleSend}
          disabled={!inputText.trim() || isTyping}
          style={{
            padding: '9px 14px',
            background: inputText.trim() ? 'rgba(0,140,255,0.2)' : 'transparent',
            border: `1px solid ${inputText.trim() ? 'rgba(0,170,255,0.4)' : 'rgba(0,170,255,0.08)'}`,
            borderRadius: '8px',
            color: inputText.trim() ? '#7dd4f8' : 'rgba(160,200,220,0.25)',
            fontSize: '12px', letterSpacing: '0.06em',
            cursor: inputText.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          send
        </button>
      </div>

      {voiceError && (
        <div style={{ padding: '0 16px 12px', color: '#f87171', fontSize: '11px', fontFamily: 'monospace' }}>
          {voiceError}
        </div>
      )}
    </div>
  )
}
