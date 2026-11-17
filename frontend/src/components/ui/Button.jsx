'use client'

import { forwardRef } from 'react'
import { Spinner } from './icons'

export const cx = (...c) => c.filter(Boolean).join(' ')

const VARIANTS = {
  primary:
    'primary-button text-white hover:-translate-y-px active:translate-y-0 ' +
    'disabled:bg-line disabled:text-muted disabled:shadow-none disabled:translate-y-0',
  secondary:
    'bg-white text-ink border border-line shadow-warm hover:border-teal hover:bg-teal-soft hover:-translate-y-px ' +
    'active:translate-y-0 disabled:text-muted disabled:bg-white disabled:shadow-none',
  soft:
    'bg-teal-soft text-teal hover:bg-teal-soft hover:text-teal-hover ',
  ghost:
    'bg-transparent text-teal hover:bg-teal-soft disabled:text-muted',
  quiet:
    'bg-transparent text-muted hover:text-ink hover:bg-cream-deep ',
}

const SIZES = {
  sm: 'h-10 px-4 text-sm gap-1.5',
  md: 'h-12 px-5 text-[15px] gap-2',
  lg: 'h-14 px-7 text-base gap-2.5',
}

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, block = false, iconLeft, iconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'relative inline-flex select-none items-center justify-center text-center rounded-[20px_24px_18px_24px] font-semibold tracking-[-0.005em]',
        'transition-transform duration-200 ease-out',
        'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal',
        'disabled:cursor-not-allowed disabled:bg-line disabled:text-muted',
        VARIANTS[variant], SIZES[size], block && 'w-full', className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 15 : 18} /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  )
})

export default Button

export function IconButton({ label, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-transform duration-200',
        'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal active:scale-95',
        'disabled:cursor-not-allowed ',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
