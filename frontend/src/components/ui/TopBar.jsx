'use client'

import { PHASES } from '@/contexts/SessionContext'
import { cx } from './Button'
import { Check } from './icons'

export const STEPS = [
  { phase: PHASES.INTAKE, label: 'About you' },
  { phase: PHASES.PAIN_SELECT, label: 'Mark pain' },
  { phase: PHASES.CHAT, label: 'Talk it through' },
  { phase: PHASES.REPORT, label: 'Your report' },
]

export function Logo({ className }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <span aria-hidden="true" className="relative inline-flex size-8 items-center justify-center rounded-[11px] bg-peach">
        <span className="size-3 rounded-full border-[2.5px] border-white" />
      </span>
      <span className="font-display text-[19px] font-semibold tracking-[-0.02em] app-logo">
        FindMy<span className="app-logo-accent">Pain</span>
      </span>
    </span>
  )
}

function Stepper({ phase, onNavigate }) {
  const current = STEPS.findIndex((s) => s.phase === phase)
  return (
    <nav className="app-progress" aria-label="Progress">
      <ol className="flex items-center gap-1 sm:gap-2">
        {STEPS.map((step, i) => {
          const done = i < current
          const active = i === current
          const content = (
            <>
              <span
                className={cx(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-none duration-300',
                  done && 'bg-teal text-white',
                  active && 'bg-white text-teal ring-2 ring-teal',
                  !done && !active && 'bg-white text-muted ring-1 ring-line',
                )}
              >
                {done ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cx(
                  'whitespace-nowrap text-sm',
                  active ? 'hidden font-semibold text-cream sm:inline' : 'hidden text-cream xl:inline',
                  done && 'group-hover:text-teal',
                )}
              >
                {step.label}
              </span>
            </>
          )
          return (
            <li key={step.phase} className="flex items-center gap-1 sm:gap-2">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cx('h-0.5 w-4 rounded-full transition-none duration-300 sm:w-8', i <= current ? 'bg-teal' : 'bg-line')}
                />
              )}
              {done ? (
                <button
                  type="button"
                  onClick={() => onNavigate(step.phase)}
                  title={`Back to: ${step.label}`}
                  className="group flex items-center gap-2 rounded-full p-0.5 pr-1.5 transition-none hover:bg-teal-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal"
                >
                  {content}
                  <span className="sr-only">(completed, go back)</span>
                </button>
              ) : (
                <span aria-label={step.label} className="flex items-center gap-2 p-0.5 pr-1.5" aria-current={active ? 'step' : undefined}>
                  {content}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default function TopBar({ phase, onNavigate }) {
  const showSteps = phase !== PHASES.LANDING
  return (
    <header className="app-header relative z-20 flex shrink-0 items-center justify-between gap-3">
      <Logo />
      {showSteps && <Stepper phase={phase} onNavigate={onNavigate} />}
    </header>
  )
}
