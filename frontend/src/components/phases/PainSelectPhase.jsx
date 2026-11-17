'use client'

import { useSession, PHASES } from '@/contexts/SessionContext'
import PainPointChip from '@/components/ui/PainPointChip'
import Button from '@/components/ui/Button'
import { ArrowRight, Pin } from '@/components/ui/icons'

export default function PainSelectPhase() {
  const { painPoints, removePainPoint, setPhase } = useSession()
  const count = painPoints.length
  const hasPoints = count > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-6 pt-5 sm:px-8 sm:pt-8">
        <h2 className="font-display text-[24px] leading-tight font-semibold tracking-[-0.02em] sm:text-[28px]">Where does it hurt?</h2>
        <p className="mt-1 text-[15px] text-muted">
          Tap each spot on the body. Drag to turn it and mark the back too.
        </p>
      </div>

      <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto px-6 py-4 sm:px-8">
        {hasPoints ? (
          <>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted" aria-live="polite">
              {count} area{count > 1 ? 's' : ''} marked
            </p>
            <div className="flex flex-wrap gap-2">
              {painPoints.map((p) => (
                <PainPointChip key={p.region} region={p.region} onRemove={removePainPoint} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-3.5 text-sm text-muted">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pain-soft text-pain-ink">
              <Pin size={18} />
            </span>
            Nothing marked yet. Your spots will show up here.
          </div>
        )}
      </div>

      <div className="border-t border-line px-6 py-4 sm:px-8">
        <Button
          block
          disabled={!hasPoints}
          onClick={() => setPhase(PHASES.CHAT)}
          iconRight={<ArrowRight size={18} />}
        >
          {hasPoints ? `Continue with ${count} area${count > 1 ? 's' : ''}` : 'Mark at least one spot'}
        </Button>
      </div>
    </div>
  )
}
