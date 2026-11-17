'use client'

import { cx } from './Button'
import { X } from './icons'

export default function PainPointChip({ region, onRemove, size = 'md' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-pain bg-white text-ink ',
        size === 'sm' ? 'h-8 pl-2.5 text-[13px]' : 'h-10 pl-3 text-sm',
        onRemove ? 'pr-1' : size === 'sm' ? 'pr-3' : 'pr-4',
      )}
    >
      <span className="relative flex size-2.5 shrink-0">
        <span className="relative size-2.5 rounded-full bg-pain" />
      </span>
      <span className="font-medium">{region}</span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(region)}
          aria-label={`Remove ${region}`}
          title={`Remove ${region}`}
          className="ml-0.5 inline-flex size-8 items-center justify-center rounded-full text-muted transition-none hover:bg-pain-soft hover:text-pain-ink focus-visible:outline-2 focus-visible:outline-teal"
        >
          <X size={15} strokeWidth={2.4} />
        </button>
      )}
    </span>
  )
}
