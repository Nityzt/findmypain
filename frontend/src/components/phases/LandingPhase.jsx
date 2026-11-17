'use client'

import { useState } from 'react'
import { useVapi } from '@/contexts/VapiContext'
import { useSession, PHASES } from '@/contexts/SessionContext'
import Button from '@/components/ui/Button'
import { ArrowRight, Pin, Chat, FileText, Shield, Alert, Mic } from '@/components/ui/icons'

const STEPS = [
  { icon: Pin, title: 'Mark where it hurts', body: 'Tap the spots on a body you can turn around.' },
  { icon: Chat, title: 'Talk it through', body: 'Answer a few short questions by voice or text.' },
  { icon: FileText, title: 'Get your report', body: 'A clear summary to download and show your doctor.' },
]

function VoiceWave() {
  return (
    <span aria-hidden="true" className="flex h-4 items-center gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="h-4 w-[3px] origin-center animate-wave rounded-full bg-current"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </span>
  )
}

export default function LandingPhase() {
  const {
    startSession, stopSession, isSpeaking, isConnecting, isConnected, mode,
    introMessage, voiceError, micPermission, introDone, hasVoice,
  } = useVapi()
  const { setPhase } = useSession()
  const [requested, setRequested] = useState(false) // user asked for the voice intro

  // Show a transcript if the requested spoken greeting fails.
  const showText = requested && introDone && Boolean(voiceError)
  const introPlaying = requested && !introDone && (isConnecting || (isConnected && mode === 'intro'))
  const canEnableMic = hasVoice && !requested

  const begin = () => {
    stopSession()
    setPhase(PHASES.INTAKE)
  }

  const playIntro = async () => {
    setRequested(true)
    await startSession({ mode: 'intro' })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
    <div className="panel-scroll panel-content scrollbar-soft min-h-0 flex-1 overflow-y-auto pb-4 pt-8 sm:pt-10">
      <p className="mb-5 inline-flex w-fit items-center gap-2 text-sm font-medium text-ink">
        <span className="size-1.5 rounded-full bg-marigold" /> Before your appointment
      </p>
      <h1 className="landing-title font-display text-ink">
        Show your doctor exactly where it hurts
      </h1>
      <p className="landing-intro mt-5 text-[16px] leading-relaxed text-ink">
        It takes about five minutes. You’ll end up with a tidy report that helps your appointment go further.
      </p>

      {showText && (
        <div className="mt-5 flex gap-3 rounded-2xl bg-cream p-4 text-[15px] leading-relaxed text-ink">
          <span aria-hidden="true" className="mt-0.5 size-7 shrink-0 rounded-full bg-peach" />
          <span>{introMessage}</span>
        </div>
      )}

      <ol className="landing-steps">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li
            key={title}
            className="paint-step"
          >
            <span className="paint-step-icon">
              <Icon size={21} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-ink">
                <span className="mr-1.5 text-muted">{i + 1}.</span>{title}
              </span>
              <span className="block text-sm text-muted">{body}</span>
            </span>
          </li>
        ))}
      </ol>

    </div>

      <div className="landing-actions panel-content">
        <Button size="lg" block onClick={begin} iconRight={<ArrowRight size={19} />}>
          Get started
        </Button>

        {hasVoice && (
          <div className="mt-2 flex flex-col items-center justify-center gap-1 text-center">
            {canEnableMic && (
              <>
                <Button variant="ghost" onClick={playIntro} iconLeft={<Mic size={18} />}>
                  Hear a quick spoken intro
                </Button>
                <span className="text-xs text-muted">
                  {micPermission === 'prompt' ? 'Your browser will ask to use your microphone.' : 'Uses your microphone and speaker.'}
                </span>
              </>
            )}
            {introPlaying && (
              <div className="flex items-center gap-3">
                <span role="status" className="inline-flex h-10 items-center gap-2.5 rounded-full bg-teal-soft px-4 text-sm font-semibold text-teal">
                  {isSpeaking ? <VoiceWave /> : <span className="size-2 animate-pulse rounded-full bg-teal" />}
                  {isConnecting ? 'Connecting…' : isSpeaking ? 'Playing intro' : 'Listening'}
                </span>
                <Button variant="quiet" size="sm" onClick={begin}>Skip</Button>
              </div>
            )}
            {requested && introDone && !voiceError && (
              <span role="status" className="text-sm text-muted">Intro finished. Tap “Get started” when you’re ready.</span>
            )}
          </div>
        )}

        {voiceError && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-pain-soft px-3 py-2.5 text-sm text-pain-ink">
            <Alert size={17} className="mt-0.5 shrink-0" /> {voiceError}
          </p>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <Shield size={14} className="shrink-0 text-teal" />
          Not a diagnosis or medical advice. In an emergency, call your local emergency number.
        </p>
      </div>
    </div>
  )
}
