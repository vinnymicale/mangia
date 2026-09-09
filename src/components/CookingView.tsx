'use client'

import { useEffect, useState } from 'react'
import { cn, formatQuantity } from '@/lib/utils'

export interface CookingIngredient {
  id: string
  quantity: number | null
  unit: string | null
  name: string
  note: string | null
}

export interface CookingViewProps {
  title: string
  ingredients: CookingIngredient[]
  steps: string[]
}

/**
 * Holds a screen wake lock for as long as the view is mounted. Unsupported
 * browsers get the same page without the lock — never an error.
 */
function useWakeLock() {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      try {
        if (!('wakeLock' in navigator)) return
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
      } catch {
        // A denied or unsupported lock is not worth surfacing to the cook.
      }
    }

    void acquire()
    return () => {
      cancelled = true
      void sentinel?.release()
    }
  }, [])
}

export function CookingView({ title, ingredients, steps }: CookingViewProps) {
  useWakeLock()
  const [done, setDone] = useState<Set<string>>(new Set())

  function toggle(key: string) {
    setDone((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="cooking-view space-y-12">
      <h1 className="text-4xl leading-tight font-semibold text-balance">{title}</h1>

      <section>
        <h2 className="mb-5 text-2xl font-bold">Ingredients</h2>
        <ul className="space-y-4">
          {ingredients.map((row) => {
            const key = `ingredient:${row.id}`
            const checked = done.has(key)
            return (
              <li key={key}>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    className="mt-2 size-6 shrink-0"
                  />
                  <span className={cn('transition-colors', checked && 'text-(--color-ink-2) line-through')}>
                    <span className="tnum font-medium text-(--color-accent)">
                      {[formatQuantity(row.quantity), row.unit].filter(Boolean).join(' ')}
                    </span>{' '}
                    {row.name}
                    {row.note && <span className="text-(--color-ink-2)">, {row.note}</span>}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-5 text-2xl font-bold">Steps</h2>
        <ol className="space-y-6">
          {steps.map((step, index) => {
            const key = `step:${index}`
            const checked = done.has(key)
            return (
              <li
                key={key}
                className={cn(
                  'rounded-[11px] border p-4 transition-colors sm:p-5',
                  checked
                    ? 'border-transparent bg-(--color-accent-soft)'
                    : 'border-(--color-border) bg-(--color-surface)',
                )}
              >
                <label className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    className="mt-2 size-6 shrink-0"
                  />
                  {/* Steps really are a sequence, so the number is information. */}
                  <span
                    aria-hidden
                    className="tnum mt-1 w-7 shrink-0 font-serif text-2xl font-semibold text-(--color-accent)"
                  >
                    {index + 1}
                  </span>
                  <span className={cn('transition-colors', checked && 'text-(--color-ink-2)')}>
                    {step}
                  </span>
                </label>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
