'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

/**
 * A styled replacement for `<select>`. Native dropdowns render in OS chrome
 * that ignores the app's palette, so the browse controls use this instead.
 *
 * Keeps a real hidden `<select>` in the tree: it carries the accessible name
 * and the form value, so tests and assistive tech address the control the same
 * way they would a native one, while the button drives the visual popover.
 */
export function Select({
  label,
  name,
  options,
  value,
  onChange,
}: {
  /** Visible prefix inside the trigger, e.g. "Sort by". */
  label: string
  /** Accessible name, when it should differ from the visible label. */
  name?: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const current = options.find((option) => option.value === value) ?? options[0]

  // A click anywhere else, or Escape, dismisses the popover.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <select
        aria-label={name ?? label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="sr-only"
        tabIndex={-1}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prior) => !prior)}
        className={cn(
          'flex items-center gap-2 rounded-[7px] border px-3.5 py-2 text-[13px] transition-colors',
          'bg-(--color-surface) text-(--color-ink)',
          open
            ? 'border-(--color-accent)'
            : 'border-(--color-border) hover:border-(--color-border-hi)',
        )}
      >
        <span className="text-(--color-ink-2)">{label}</span>
        <span className="font-medium">{current?.label}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3.5 text-(--color-ink-2) transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-30 mt-1.5 min-w-full overflow-hidden rounded-[9px] border border-(--color-border) bg-(--color-surface) py-1 shadow-(--shadow-card-hover)"
        >
          {options.map((option) => {
            const selected = option.value === value
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors',
                    selected
                      ? 'text-(--color-accent)'
                      : 'text-(--color-ink) hover:bg-(--color-surface-hi)',
                  )}
                >
                  <Check
                    aria-hidden
                    className={cn('size-3.5 shrink-0', !selected && 'opacity-0')}
                  />
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
