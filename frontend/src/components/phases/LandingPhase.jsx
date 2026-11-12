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
  const {
    startSession, stopSession, isSpeaking, isConnecting, isConnected, mode,
    introMessage, voiceError, micPermission, introDone, hasVoice,
  } = useVapi()
  const { setPhase } = useSession()
  const [ready, setReady] = useState(false)        // fade-in delay before first prompt
  const [requested, setRequested] = useState(false) // user asked for the voice intro

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1000)
    return () => clearTimeout(t)
  }, [])

  // Show the greeting as text when voice isn't configured, or when it failed
  // (mic blocked, start error).
  const showText = ready && (!hasVoice || (requested && introDone && Boolean(voiceError)))

  const introPlaying = requested && !introDone && (isConnecting || (isConnected && mode === 'intro'))
  const canBegin = ready && (!hasVoice || introDone || showText)
  const canEnableMic = ready && hasVoice && !requested

  const begin = () => {
    stopSession()
    setPhase(PHASES.INTAKE)
  }

  const handleClick = async () => {
    if (canBegin) return begin()
    if (canEnableMic) {
      setRequested(true)
      await startSession({ mode: 'intro' })
    }
  }

  const clickable = canBegin || canEnableMic

  return (
    <div
      onClick={clickable ? handleClick : undefined}
      style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        cursor: clickable ? 'pointer' : 'default',
        pointerEvents: clickable ? 'auto' : 'none',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,208,255,0.008) 3px, rgba(0,208,255,0.008) 4px)',
      }} />

      <div style={{
        position: 'absolute', top: 28, left: 32,
        fontSize: '12px', letterSpacing: '0.18em', color: 'rgba(0,170,255,0.5)',
        fontWeight: 400, animation: 'fadeIn 1.5s ease forwards',
      }}>
        findmypain
      </div>

      {(isSpeaking || introPlaying) && (
        <div style={{
          position: 'absolute', bottom: '22vh',
          display: 'flex', gap: '4px', alignItems: 'center',
        }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{
              width: '2px', background: '#00aaff', borderRadius: '1px',
              height: '14px', opacity: isSpeaking ? 0.7 : 0.3,
              animation: isSpeaking ? `waveBar 0.7s ${i * 0.1}s ease-in-out infinite alternate` : 'none',
            }} />
          ))}
        </div>
      )}

      {showText && (
        <div style={{
          position: 'absolute', bottom: '20vh',
          maxWidth: '360px', padding: '0 24px', textAlign: 'center',
        }}>
          <div style={{
            padding: '16px 20px',
            background: 'rgba(0,15,35,0.6)',
            border: '1px solid rgba(0,170,255,0.12)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
          }}>
            <Typewriter text={introMessage} />
          </div>
        </div>
      )}

      {(clickable || introPlaying) && (
        <div style={{
          position: 'absolute', bottom: '7vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          padding: '0 16px',
          animation: introPlaying ? 'none' : 'fadePulse 2.8s ease-in-out infinite',
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
            {introPlaying ? 'listening to intro…' : canBegin ? 'tap to begin' : 'tap to enable microphone'}
          </span>
          {canEnableMic && micPermission === 'prompt' && (
            <span style={{ fontSize: '10px', color: '#5a90b0', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
              your browser will ask for permission
            </span>
          )}
          {voiceError && (
            <span style={{ maxWidth: '320px', textAlign: 'center', fontSize: '11px', color: '#f87171', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
              {voiceError}
            </span>
          )}
          {!canBegin && (
            <button
              onClick={(e) => { e.stopPropagation(); begin() }}
              style={{
                marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer',
                pointerEvents: 'auto',
                color: 'rgba(160,200,220,0.45)', fontSize: '11px', letterSpacing: '0.08em',
                textDecoration: 'underline', textUnderlineOffset: '3px',
              }}
            >
              {introPlaying ? 'skip intro' : 'continue without voice'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
