'use client'

import { useEffect, useState, useRef } from 'react'
import { useVapi } from '@/contexts/VapiContext'
import { useSession, PHASES } from '@/contexts/SessionContext'

function Typewriter({ text, speed = 28, onDone }) {
  const [displayed, setDisplayed] = useState('')
  const idx = useRef(0)

  useEffect(() => {
    idx.current = 0
    setDisplayed('')
    const iv = setInterval(() => {
      idx.current++
      setDisplayed(text.slice(0, idx.current))
      if (idx.current >= text.length) { clearInterval(iv); onDone?.() }
    }, speed)
    return () => clearInterval(iv)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span style={{ color: '#94b8d0', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>
      {displayed}
      {displayed.length < text.length && (
        <span style={{ animation: 'fadePulse 1s ease-in-out infinite', opacity: 0.6 }}>▌</span>
      )}
    </span>
  )
}

export default function LandingPhase() {
  const { startSession, isSpeaking, introMessage, voiceError, micPermission } = useVapi()
  const { setPhase } = useSession()
  const [showPrompt,     setShowPrompt]     = useState(false)
  const [showTypewriter, setShowTypewriter] = useState(false)
  const [introPlayed,    setIntroPlayed]    = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const timer = setTimeout(() => {
      const apiKey =
        process.env.NEXT_PUBLIC_VAPI_API_KEY ||
        process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ||
        ''

      if (!apiKey) {
        // No Vapi key — show typewriter fallback after short delay
        setShowTypewriter(true)
        return
      }

      setShowPrompt(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  // Also show prompt once the intro finishes speaking
  useEffect(() => {
    if (!introPlayed || isSpeaking) return
    const t = setTimeout(() => setShowPrompt(true), 1200)
    return () => clearTimeout(t)
  }, [introPlayed, isSpeaking])

  const canClick = showPrompt || showTypewriter

  const handleLandingClick = async () => {
    if (showTypewriter || introPlayed) {
      setPhase(PHASES.INTAKE)
      return
    }

    setShowPrompt(false)
    const started = await startSession({ isIntro: true })
    if (started) {
      setIntroPlayed(true)
    } else {
      setShowPrompt(true)
    }
  }

  return (
    <div
      onClick={() => { if (showPrompt || showTypewriter) handleLandingClick() }}
      style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        cursor: canClick ? 'pointer' : 'default',
        pointerEvents: canClick ? 'auto' : 'none',
      }}
    >
      {/* Subtle scan lines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,208,255,0.008) 3px, rgba(0,208,255,0.008) 4px)',
      }} />

      {/* App name — top left, minimal */}
      <div style={{
        position: 'absolute', top: 28, left: 32,
        fontSize: '12px', letterSpacing: '0.18em', color: 'rgba(0,170,255,0.5)',
        fontWeight: 400, animation: 'fadeIn 1.5s ease forwards',
      }}>
        findmypain
      </div>

      {/* Speaking waveform — bottom-ish, subtle */}
      {isSpeaking && (
        <div style={{
          position: 'absolute', bottom: '22vh',
          display: 'flex', gap: '4px', alignItems: 'center',
        }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: '2px', background: '#00aaff', borderRadius: '1px',
              height: '14px', opacity: 0.7,
              animation: `waveBar 0.7s ${i * 0.1}s ease-in-out infinite alternate`,
            }} />
          ))}
        </div>
      )}

      {/* Typewriter card — no Vapi key */}
      {showTypewriter && (
        <div style={{
          position: 'absolute', bottom: '20vh',
          maxWidth: '340px', padding: '0 32px', textAlign: 'center',
        }}>
          <div style={{
            padding: '16px 20px',
            background: 'rgba(0,15,35,0.6)',
            border: '1px solid rgba(0,170,255,0.12)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
          }}>
            <Typewriter
              text={introMessage}
              onDone={() => setTimeout(() => setShowPrompt(true), 600)}
            />
          </div>
        </div>
      )}

      {/* Click / tap prompt */}
      {canClick && (
        <div style={{
          position: 'absolute', bottom: '7vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          animation: 'fadePulse 2.8s ease-in-out infinite',
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            border: '1px solid rgba(0,208,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: '#00d0ff', boxShadow: '0 0 10px #00d0ff',
            }} />
          </div>
          <span style={{
            fontSize: '11px', color: 'rgba(160,200,220,0.6)',
            letterSpacing: '0.2em', fontWeight: 400,
          }}>
            {introPlayed || showTypewriter ? 'tap to begin' : 'enable microphone'}
          </span>
          {micPermission === 'prompt' && !introPlayed && !showTypewriter && (
            <span style={{ fontSize: '10px', color: '#5a90b0', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
              Browser will ask for permission
            </span>
          )}
          {voiceError && (
            <span style={{ maxWidth: '320px', textAlign: 'center', fontSize: '11px', color: '#ef4444', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
              {voiceError}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
