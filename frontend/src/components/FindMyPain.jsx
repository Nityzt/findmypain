'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { SessionProvider, VapiProvider } from './Providers'
import { useSession, PHASES } from '@/contexts/SessionContext'
import { useVapi } from '@/contexts/VapiContext'
import SpriteBody from './body/SpriteBody'
import TopBar from './ui/TopBar'
import { cx } from './ui/Button'
import { Hand, Rotate } from './ui/icons'
import LandingPhase from './phases/LandingPhase'
import IntakePhase from './phases/IntakePhase'
import PainSelectPhase from './phases/PainSelectPhase'
import ChatPhase from './phases/ChatPhase'

// ReportPhase imports @react-pdf/renderer — keep it fully out of SSR bundle
const ReportPhase = dynamic(() => import('./phases/ReportPhase'), { ssr: false })

// The full WebGL model (three.js / react-three-fiber) only loads when chosen.
const BodyScene3D = dynamic(() => import('./3d/BodyScene'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <span aria-label="Loading 3D model" className="size-8 animate-[spin_0.9s_linear_infinite] rounded-full border-[3px] border-teal-soft border-t-teal" />
    </div>
  ),
})

const RENDERER_KEY = 'fmp:body-renderer'
const RENDERERS = [
  { id: 'lite', label: 'Lite', title: 'Lightweight body (works on any device)' },
  { id: '3d', label: '3D', title: 'Full 3D model (uses WebGL)' },
]

function readRenderer() {
  try {
    const v = window.localStorage.getItem(RENDERER_KEY)
    return v === '3d' ? '3d' : 'lite'
  } catch {
    return 'lite'
  }
}

function RendererToggle({ value, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-label="Body view"
      className="view-toggle z-20 flex rounded-full bg-cream p-1 text-xs font-semibold"
    >
      {RENDERERS.map((r) => {
        const active = value === r.id
        return (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={r.title}
            onClick={() => onChange(r.id)}
            className={cx(
              'min-h-9 rounded-full px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
              active ? 'bg-teal text-white' : 'text-ink hover:bg-teal-soft',
            )}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

function StageHint({ phase, hasPoints }) {
  if (phase !== PHASES.PAIN_SELECT || hasPoints) return null
  return (
    <div
      className="pointer-events-none"
    >
      <span className="body-hint inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm font-medium text-ink">
        <Hand size={17} className="text-peach" />
        Tap where it hurts
        <span aria-hidden="true" className="text-muted">·</span>
        <Rotate size={17} className="text-teal" />
        Drag to turn
      </span>
    </div>
  )
}

function AppLayout() {
  const { phase, setPhase, painPoints, addPainPoint, setScreenshot } = useSession()
  const { isSpeaking } = useVapi()
  const captureRef = useRef(null)
  const mainRef = useRef(null)
  // A completed mobile form can leave the shared scroller partway down.
  // Each screen starts with its body and instructions fully in view.
  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [phase])
  const isReport = phase === PHASES.REPORT
  const [renderer, setRendererState] = useState(readRenderer)
  const setRenderer = useCallback((next) => {
    setRendererState(next)
    try { window.localStorage.setItem(RENDERER_KEY, next) } catch { /* private mode */ }
  }, [])

  const handleRegionClick = useCallback((region, point3D) => {
    addPainPoint(region, point3D)
  }, [addPainPoint])

  // Snapshot the body (with pain markers) for the PDF while it is still
  // mounted, then switch to the report screen.
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
    <div data-phase={phase} className="app-shell relative flex w-full flex-col overflow-hidden text-ink">
      <TopBar phase={phase} onNavigate={setPhase} />

      {isReport ? (
        <ReportPhase />
      ) : (
        <main ref={mainRef} className="app-main relative z-10 min-h-0 flex-1">
          {/* Body stage */}
          <section
            aria-label="Body"
            className="body-stage"
          >
            <div className="paint-stage">
              <div aria-hidden="true" className="paint-pool paint-pool-coral" />
              <div aria-hidden="true" className="paint-pool paint-pool-teal" />
              <div aria-hidden="true" className="paint-body-field" />
              {renderer === '3d' ? (
                <div className="absolute inset-0">
                  <BodyScene3D
                    phase={phase}
                    painPoints={painPoints}
                    onRegionClick={handleRegionClick}
                    captureRef={captureRef}
                  />
                </div>
              ) : (
                <SpriteBody
                  phase={phase}
                  painPoints={painPoints}
                  onRegionClick={handleRegionClick}
                  captureRef={captureRef}
                  isSpeaking={isSpeaking}
                />
              )}
              <StageHint phase={phase} hasPoints={painPoints.length > 0} />
              <RendererToggle value={renderer} onChange={setRenderer} />
            </div>
          </section>

          {/* Step panel */}
          <aside
            className="paint-panel relative z-10 flex min-h-0 flex-col overflow-hidden"
          >
            <div key={phase} className="flex min-h-0 flex-1 flex-col">
              {phase === PHASES.LANDING && <LandingPhase />}
              {phase === PHASES.INTAKE && <IntakePhase />}
              {phase === PHASES.PAIN_SELECT && <PainSelectPhase />}
              {phase === PHASES.CHAT && <ChatPhase onReadyForReport={goToReport} />}
            </div>
          </aside>
        </main>
      )}
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
