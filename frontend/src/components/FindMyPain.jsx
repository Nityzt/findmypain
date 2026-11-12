'use client'

import { useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { SessionProvider, VapiProvider } from './Providers'
import { useSession, PHASES } from '@/contexts/SessionContext'
import BodyScene from './3d/BodyScene'
import LandingPhase from './phases/LandingPhase'
import IntakePhase from './phases/IntakePhase'
import PainSelectPhase from './phases/PainSelectPhase'
import ChatPhase from './phases/ChatPhase'

// ReportPhase imports @react-pdf/renderer — keep it fully out of SSR bundle
const ReportPhase = dynamic(() => import('./phases/ReportPhase'), { ssr: false })

function AppLayout() {
  const { phase, setPhase, painPoints, addPainPoint, setScreenshot } = useSession()
  const captureRef = useRef(null)

  const isChat  = phase === PHASES.CHAT
  const isReport = phase === PHASES.REPORT

  const handleRegionClick = useCallback((region, point3D) => {
    addPainPoint(region, point3D)
  }, [addPainPoint])

  // Snapshot the body (with pain markers) for the PDF while the canvas is
  // still visible, then switch to the report screen.
  const goToReport = useCallback(() => {
    try {
      const shot = captureRef.current?.()
      if (shot) setScreenshot(shot)
    } catch (err) {
      console.warn('[Report] could not capture body image', err)
    }
    setPhase(PHASES.REPORT)
  }, [setPhase, setScreenshot])

  return (
    <div
      className={`bc-root${isChat ? ' bc-chat' : ''}`}
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: 'radial-gradient(ellipse at 50% 30%, #071828 0%, #040d1a 55%, #020810 100%)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* 3D Body Canvas — left side */}
      <div
        className="bc-canvas"
        style={{
          position: 'relative',
          flex: isChat ? '0 0 42%' : '1',
          width: isChat ? '42%' : '100%',
          transition: 'flex 0.6s cubic-bezier(0.4,0,0.2,1), width 0.6s cubic-bezier(0.4,0,0.2,1)',
          display: isReport ? 'none' : 'block',
        }}
      >
        {/* Dot-grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(0,180,255,0.1) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        <BodyScene
          phase={phase}
          painPoints={painPoints}
          onRegionClick={handleRegionClick}
          captureRef={captureRef}
        />

        {/* Phase overlays */}
        {phase === PHASES.LANDING     && <LandingPhase />}
        {phase === PHASES.INTAKE      && <IntakePhase />}
        {phase === PHASES.PAIN_SELECT && <PainSelectPhase />}
      </div>

      {/* Right panel — Chat phase */}
      {isChat && (
        <div
          className="bc-panel"
          style={{
            flex: '0 0 58%',
            width: '58%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ChatPhase onReadyForReport={goToReport} />
        </div>
      )}

      {/* Report — full screen overlay */}
      {isReport && <ReportPhase />}
    </div>
  )
}

export default function FindMyPain() {
  return (
    <SessionProvider>
      <VapiProvider>
        <AppLayout />
      </VapiProvider>
    </SessionProvider>
  )
}
