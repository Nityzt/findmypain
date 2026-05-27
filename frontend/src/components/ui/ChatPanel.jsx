'use client'

import { useState, useRef, useEffect } from 'react'
import { useVapi } from '@/contexts/VapiContext'
import { useSession } from '@/contexts/SessionContext'
import PainPointChip from './PainPointChip'

function normalizeApiBase(value) {
  if (!value || value.startsWith('/')) return 'http://localhost:8080'
  return value
}

const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE_URL)

export default function ChatPanel({ onReadyForReport }) {
  const { intake, painPoints, removePainPoint, chatHistory, addMessage, sessionId, assessment } = useSession()
  const {
    isSpeaking,
    isListening,
    isConnected,
    sendMessage,
    startSession,
    stopSession,
    voiceError,
    lastMessage,
  } = useVapi()
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const exchangeCount = chatHistory.filter(m => m.role === 'user').length

  // Sync Vapi voice turns into shared chat history
  useEffect(() => {
    if (!lastMessage?.content) return
    const last = chatHistory[chatHistory.length - 1]
    if (last?.role === lastMessage.role && last?.content === lastMessage.content) return
    addMessage(lastMessage.role, lastMessage.content)
    if (lastMessage.role === 'assistant' &&
        lastMessage.content.toLowerCase().includes("enough to generate")) {
      setTimeout(() => onReadyForReport?.(), 1200)
    }
  }, [lastMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text) return
    setInputText('')
    addMessage('user', text)
    setIsTyping(true)

    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text, history: chatHistory }),
      })
      if (res.ok) {
        const data = await res.json()
        addMessage('assistant', data.reply)
        if (data.isComplete) onReadyForReport?.()
      }
    } catch {
      if (isConnected) sendMessage(text)
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleMicClick = () => {
    if (isConnected) {
      stopSession()
      return
    }

    startSession({ intake, painPoints, isIntro: false })
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(3,10,22,0.92)',
      borderLeft: '1px solid rgba(0,170,255,0.1)',
    }}>
      {/* Pain chips — compact */}
      {painPoints.length > 0 && (
        <div style={{
          padding: '10px 14px 8px',
          borderBottom: '1px solid rgba(0,170,255,0.08)',
          display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
        }}>
          {painPoints.map((p) => (
            <PainPointChip key={p.region} region={p.region} onRemove={removePainPoint} />
          ))}
        </div>
      )}

      {/* Message thread */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 14px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {chatHistory.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'rgba(90,144,176,0.4)',
            fontSize: '13px',
            marginTop: '28px',
            fontStyle: 'italic',
            fontWeight: 300,
          }}>
            starting your assessment...
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
              background: msg.role === 'user'
                ? 'rgba(0,60,140,0.3)'
                : 'rgba(0,20,50,0.5)',
              border: msg.role === 'user'
                ? '1px solid rgba(0,170,255,0.2)'
                : '1px solid rgba(0,170,255,0.08)',
              color: msg.role === 'user' ? '#bde0fa' : '#8fc4de',
              fontSize: '14px',
              lineHeight: '1.55',
              fontWeight: 300,
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing dots */}
        {(isTyping || (isSpeaking && chatHistory[chatHistory.length - 1]?.role === 'user')) && (
          <div style={{ display: 'flex', gap: '5px', padding: '6px 2px', alignItems: 'center' }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#00aaff', opacity: 0.5,
                animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        )}

        {isSpeaking && (
          <div style={{
            fontSize: '10px', color: 'rgba(0,170,255,0.45)',
            fontFamily: 'monospace', letterSpacing: '0.1em',
            textAlign: 'left', paddingLeft: '2px',
          }}>
            speaking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Generate report — appears after enough exchanges */}
      {(exchangeCount >= 4 || assessment) && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(0,170,255,0.08)' }}>
          <button
            onClick={onReadyForReport}
            style={{
              width: '100%', padding: '11px',
              background: 'rgba(0,60,160,0.15)',
              border: '1px solid rgba(0,170,255,0.35)',
              borderRadius: '8px',
              color: '#7dd4f8', fontSize: '12px',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            generate report →
          </button>
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: '10px 14px 14px',
        borderTop: '1px solid rgba(0,170,255,0.08)',
        display: 'flex', gap: '8px', alignItems: 'center',
      }}>
        {/* Mic status indicator */}
        <button
          type="button"
          onClick={handleMicClick}
          title={isConnected ? 'Stop voice assistant' : 'Start voice assistant'}
          style={{
            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
            background: isListening ? 'rgba(0,208,255,0.14)' : 'rgba(0,170,255,0.06)',
            border: `1px solid ${isListening ? '#00d0ff' : 'rgba(0,170,255,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px',
            boxShadow: isListening ? '0 0 10px rgba(0,208,255,0.45)' : 'none',
            animation: isListening ? 'pulse 1.5s ease-in-out infinite' : 'none',
            cursor: 'pointer',
            padding: 0,
            color: '#7dd4f8',
          }}
        >
          {isConnected ? '■' : '●'}
        </button>

        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'listening...' : 'type your answer'}
          style={{
            flex: 1, padding: '9px 12px',
            background: 'rgba(0,12,28,0.5)',
            border: '1px solid rgba(0,170,255,0.1)',
            borderRadius: '8px',
            color: '#c8e8ff', fontSize: '14px',
            outline: 'none', fontWeight: 300,
          }}
        />

        <button
          onClick={handleSend}
          disabled={!inputText.trim()}
          style={{
            padding: '9px 14px',
            background: inputText.trim() ? 'rgba(0,140,255,0.2)' : 'transparent',
            border: `1px solid ${inputText.trim() ? 'rgba(0,170,255,0.4)' : 'rgba(0,170,255,0.08)'}`,
            borderRadius: '8px',
            color: inputText.trim() ? '#7dd4f8' : 'rgba(160,200,220,0.2)',
            fontSize: '12px', letterSpacing: '0.06em',
            cursor: inputText.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >
          send
        </button>
      </div>

      {voiceError && (
        <div style={{
          padding: '0 16px 12px',
          color: '#ef4444',
          fontSize: '11px',
          fontFamily: 'monospace',
        }}>
          {voiceError}
        </div>
      )}
    </div>
  )
}
