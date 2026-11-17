'use client'

import { forwardRef, useId, useRef } from 'react'
import { cx } from './Button'
import { Check } from './icons'

export const TextField = forwardRef(function TextField(
  { label, hint, error, optional, className, inputClassName, id: idProp, ...rest },
  ref,
) {
  const autoId = useId()
  const id = idProp || autoId
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const describedBy = [hint && hintId, error && errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-sm font-semibold text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-muted">Optional</span>}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          'h-12 w-full rounded-2xl border bg-white px-4 text-base text-ink placeholder:text-muted',
          'transition-transform duration-200 outline-none',
          'hover:border-teal focus:border-teal focus:ring-2 focus:ring-teal',
          error ? 'border-pain focus:border-pain focus:ring-pain' : 'border-line',
          inputClassName,
        )}
        {...rest}
      />
      {hint && !error && <p id={hintId} className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p id={errId} role="alert" className="mt-1.5 text-xs font-medium text-pain-ink">{error}</p>}
    </div>
  )
})

// A row of selectable pills that behaves as a radio group (arrow keys move).
export function ChoicePills({ label, options, value, onChange, optional, className }) {
  const groupId = useId()
  const refs = useRef([])
  const selectedIndex = options.indexOf(value)

  const onKeyDown = (e, i) => {
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length
    if (next === null) return
    e.preventDefault()
    onChange(options[next])
    refs.current[next]?.focus()
  }

  return (
    <div className={className}>
      <div id={groupId} className="mb-2 flex items-baseline justify-between text-sm font-semibold text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-muted">Optional</span>}
      </div>
      <div role="radiogroup" aria-labelledby={groupId} className="flex flex-wrap gap-2">
        {options.map((opt, i) => {
          const active = value === opt
          return (
            <button
              key={opt}
              ref={(el) => { refs.current[i] = el }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active || (selectedIndex === -1 && i === 0) ? 0 : -1}
              onClick={() => onChange(active && optional ? '' : opt)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cx(
                'inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium',
                'transition-transform duration-200 active:scale-[0.97]',
                'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal',
                active
                  ? 'border-teal bg-teal text-white shadow-button'
                  : 'border-line bg-white text-ink hover:border-teal hover:bg-teal-soft',
              )}
            >
              {active && <Check size={16} strokeWidth={2.6} />}
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
