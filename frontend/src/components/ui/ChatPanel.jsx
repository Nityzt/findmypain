'use client'

import { useState, useRef, useEffect } from 'react'
import { useVapi } from '@/contexts/VapiContext'
import { useSession } from '@/contexts/SessionContext'
import PainPointChip from './PainPointChip'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export default function ChatPanel({ onReadyForReport }) {
  const { painPoints, removePainPoint, chatHistory, addMessage, sessionId, assessment } = useSession()
  const { isSpeaking, isListening, isConnected, sendMessage } = useVapi()
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const exchangeCount = chatHistory.filter(m => m.role === 'user').length

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
        body: JSON.stringify({
          sessionId,
          message: text,
          history: chatHistory,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        addMessage('assistant', data.reply)
        if (data.isComplete) onReadyForReport?.()
      }
    } catch (err) {
      // Fallback: send through Vapi if connected
      if (isConnected) sendMessage(text)
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#060e1e',
      borderLeft: '1px solid rgba(0,170,255,0.2)',
    }}>
      {/* Pain point chips */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid rgba(0,170,255,0.12)',
        display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center',
      }}>
        <span style={{ fontSize: '11px', color: '#5a90b0', fontFamily: 'monospace', marginRight: '4px' }}>
          PAIN SITES:
        </span>
        {painPoints.map((p) => (
          <PainPointChip key={p.region} region={p.region} onRemove={removePainPoint} />
        ))}
        {painPoints.length === 0 && (
          <span style={{ fontSize: '12px', color: '#3a6080', fontStyle: 'italic' }}>
            No regions selected
          </span>
        )}
      </div>

      {/* Message thread */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        {chatHistory.length === 0 && (
          <div style={{
            textAlign: 'center', color: '#3a6080', fontSize: '13px',
            marginTop: '24px', fontStyle: 'italic',
          }}>
            The AI is ready to ask you questions about your pain...
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.role === 'user' ? '#0b2a4a' : '#071520',
              border: msg.role === 'user'
                ? '1px solid rgba(0,170,255,0.3)'
                : '1px solid rgba(0,170,255,0.12)',
              color: msg.role === 'user' ? '#c8e8ff' : '#a0cce0',
              fontSize: '14px',
              lineHeight: '1.5',
            }}>
              {msg.role === 'assistant' && (
                <span style={{ fontSize: '10px', color: '#00aaff', display: 'block', marginBottom: '4px', fontFamily: 'monospace' }}>
                  FINDMYPAIN AI
                </span>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {(isTyping || (isSpeaking && chatHistory[chatHistory.length - 1]?.role === 'user')) && (
          <div style={{ display: 'flex', gap: '5px', padding: '10px 14px' }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#00aaff', opacity: 0.6,
                animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        )}

        {isSpeaking && (
          <div style={{
            fontSize: '11px', color: '#00aaff', fontFamily: 'monospace',
            textAlign: 'center', opacity: 0.7,
          }}>
            ◉ AI SPEAKING...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Generate report button — appears after enough exchanges */}
      {(exchangeCount >= 4 || assessment) && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(0,170,255,0.12)' }}>
          <button
            onClick={onReadyForReport}
            style={{
              width: '100%', padding: '12px',
              background: 'linear-gradient(135deg, #0b3060, #0b2040)',
              border: '1px solid #00aaff',
              borderRadius: '8px',
              color: '#00d0ff', fontSize: '13px',
              fontFamily: 'monospace', letterSpacing: '0.08em',
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(0,170,255,0.2)',
            }}
          >
            ▣ GENERATE REPORT
          </button>
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(0,170,255,0.12)',
        display: 'flex', gap: '10px', alignItems: 'center',
      }}>
        {/* Mic status indicator */}
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
          background: isListening ? 'rgba(0,208,255,0.15)' : 'rgba(0,170,255,0.08)',
          border: `1px solid ${isListening ? '#00d0ff' : '#0044aa'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px',
          boxShadow: isListening ? '0 0 12px rgba(0,208,255,0.4)' : 'none',
          animation: isListening ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}>
          🎤
        </div>

        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening... or type here' : 'Type your answer...'}
          style={{
            flex: 1, padding: '10px 14px',
            background: 'rgba(0,20,40,0.8)',
            border: '1px solid rgba(0,170,255,0.2)',
            borderRadius: '8px',
            color: '#e0f4ff', fontSize: '14px',
            outline: 'none',
          }}
        />

        <button
          onClick={handleSend}
          disabled={!inputText.trim()}
          style={{
            padding: '10px 16px',
            background: inputText.trim() ? '#00aaff' : '#0a2040',
            border: 'none', borderRadius: '8px',
            color: inputText.trim() ? '#000' : '#2a4060',
            fontSize: '13px', fontFamily: 'monospace',
            cursor: inputText.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}
        >
          SEND
        </button>
      </div>
    </div>
  )
}
