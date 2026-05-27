'use client'

import { useEffect, useState, useRef } from 'react'
import { useVapi } from '@/contexts/VapiContext'
import { useSession, PHASES } from '@/contexts/SessionContext'

// Typewriter animation for no-Vapi fallback
function Typewriter({ text, speed = 32, onDone }) {
  const [displayed, setDisplayed] = useState('')
  const idx = useRef(0)

  useEffect(() => {
    idx.current = 0
    setDisplayed('')
    const iv = setInterval(() => {
      idx.current++
      setDisplayed(text.slice(0, idx.current))
      if (idx.current >= text.length) {
        clearInterval(iv)
        onDone?.()
      }
    }, speed)
    return () => clearInterval(iv)
  }, [text, speed, onDone])

  return (
    <span style={{ color: '#a0cce0', fontSize: '14px', fontFamily: 'monospace', lineHeight: 1.6 }}>
      {displayed}
      <span style={{ animation: 'fadePulse 1s ease-in-out infinite', opacity: displayed.length < text.length ? 1 : 0 }}>|</span>
    </span>
  )
}

export default function LandingPhase() {
  const { startSession, isSpeaking, introMessage } = useVapi()
  const { setPhase } = useSession()
  const [showPrompt,  setShowPrompt]  = useState(false)
  const [introPlayed, setIntroPlayed] = useState(false)
  const [showTypewriter, setShowTypewriter] = useState(false)
  const hasStarted = useRef(false)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    const timer = setTimeout(async () => {
      const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY || ''

      if (!apiKey) {
        // No Vapi key — show typewriter fallback after short delay
        setShowTypewriter(true)
        return
      }

      await startSession({ isIntro: true })
      setIntroPlayed(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [startSession])

  // After Vapi intro starts, show click-to-begin after ~4s
  useEffect(() => {
    if (!introPlayed) return
    const t = setTimeout(() => setShowPrompt(true), 4000)
    return () => clearTimeout(t)
  }, [introPlayed])

  // After Vapi speaking stops, also reveal prompt
  useEffect(() => {
    if (!isSpeaking || showPrompt) return
    const t = setTimeout(() => setShowPrompt(true), 1000)
    return () => clearTimeout(t)
  }, [isSpeaking, showPrompt])

  return (
    <div
      onClick={() => { if (showPrompt || showTypewriter) setPhase(PHASES.INTAKE) }}
      style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        paddingBottom: '8vh',
        cursor: (showPrompt || showTypewriter) ? 'pointer' : 'default',
        pointerEvents: (showPrompt || showTypewriter) ? 'auto' : 'none',
      }}
    >
      {/* App title */}
      <div style={{
        position: 'absolute', top: '32px', left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        animation: 'fadeIn 1s ease forwards',
        whiteSpace: 'nowrap',
      }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.35em', color: '#00aaff', fontFamily: 'monospace', marginBottom: '6px', opacity: 0.8 }}>
          FINDMYPAIN
        </div>
        <div style={{ fontSize: '28px', fontWeight: 300, color: '#e0f4ff', letterSpacing: '0.05em' }}>
          Body Intelligence
        </div>
      </div>

      {/* Subtle scan-lines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,208,255,0.012) 2px, rgba(0,208,255,0.012) 4px)',
        animation: 'scanlines 8s linear infinite',
      }} />

      {/* Vapi speaking indicator */}
      {isSpeaking && (
        <div style={{ position: 'absolute', bottom: '22vh', display: 'flex', gap: '5px', alignItems: 'center' }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: '3px', background: '#00d0ff', borderRadius: '2px', opacity: 0.8,
              animation: `waveBar 0.8s ${i * 0.12}s ease-in-out infinite alternate`,
              height: '12px',
            }} />
          ))}
          <span style={{ fontSize: '11px', color: '#00aaff', fontFamily: 'monospace', marginLeft: '10px', opacity: 0.7 }}>
            AI SPEAKING
          </span>
        </div>
      )}

      {/* Typewriter fallback — shown when no Vapi key */}
      {showTypewriter && (
        <div style={{
          position: 'absolute', bottom: '18vh',
          maxWidth: '380px', textAlign: 'center', padding: '0 24px',
        }}>
          <div style={{
            padding: '14px 18px',
            background: 'rgba(0,20,50,0.7)',
            border: '1px solid rgba(0,170,255,0.2)',
            borderRadius: '12px',
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{ fontSize: '9px', color: '#00aaff', fontFamily: 'monospace', letterSpacing: '0.2em', marginBottom: '8px' }}>
              FINDMYPAIN AI
            </div>
            <Typewriter
              text={introMessage}
              speed={28}
              onDone={() => setTimeout(() => setShowPrompt(true), 800)}
            />
          </div>
        </div>
      )}

      {/* Click to begin prompt */}
      {showPrompt && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          animation: 'fadePulse 2.5s ease-in-out infinite',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            border: '1px solid rgba(0,208,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d0ff', boxShadow: '0 0 8px #00d0ff' }} />
          </div>
          <span style={{ fontSize: '12px', color: '#a0cce0', fontFamily: 'monospace', letterSpacing: '0.15em' }}>
            CLICK TO BEGIN
          </span>
        </div>
      )}
    </div>
  )
}
