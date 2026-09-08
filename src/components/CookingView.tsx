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
    <div className="cooking-view space-y-10">
      <h1 className="text-3xl font-semibold">{title}</h1>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Ingredients</h2>
        <ul className="space-y-3">
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
                    className="mt-1.5 size-5 shrink-0"
                  />
                  <span className={cn(checked && 'text-(--color-ink-muted) line-through')}>
                    <span className="font-medium">
                      {[formatQuantity(row.quantity), row.unit].filter(Boolean).join(' ')}
                    </span>{' '}
                    {row.name}
                    {row.note && <span className="text-(--color-ink-muted)">, {row.note}</span>}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Steps</h2>
        <ol className="space-y-5">
          {steps.map((step, index) => {
            const key = `step:${index}`
            const checked = done.has(key)
            return (
              <li key={key}>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    className="mt-1.5 size-5 shrink-0"
                  />
                  <span className={cn(checked && 'text-(--color-ink-muted)')}>{step}</span>
                </label>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
