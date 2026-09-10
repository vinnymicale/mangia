'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { button } from '@/components/ui'
import { cn, formatCookDate } from '@/lib/utils'

export interface CookHistoryEntry {
  id: string
  /** ISO, because it crossed the server/client boundary to get here. */
  cookedAt: string
  note: string | null
}

/**
 * A recipe's cooking history: every time it was made, not just the last time.
 *
 * The list is seeded by the server component and then maintained here, so
 * logging a cook updates the panel without a round trip through a full page
 * render. router.refresh still runs, because Recipe.lastCookedAt feeds the
 * header badge and the "cooked" sort on the browse page.
 */
export function CookHistory({
  recipeId,
  initialEntries,
}: {
  recipeId: string
  initialEntries: CookHistoryEntry[]
}) {
  const router = useRouter()
  const [entries, setEntries] = useState(initialEntries)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  async function log() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/recipes/${recipeId}/cook-log`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!response.ok) throw new Error()
      const entry = (await response.json()) as CookHistoryEntry
      setEntries((current) => [entry, ...current])
      startTransition(() => router.refresh())
    } catch {
      setError('Could not record that cook.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    // Removed from the list first: a mis-logged cook is the common case, and
    // waiting on the network to see it go makes the button feel broken.
    const previous = entries
    setEntries((current) => current.filter((entry) => entry.id !== id))
    try {
      const response = await fetch(`/api/cook-log/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      startTransition(() => router.refresh())
    } catch {
      setEntries(previous)
      setError('Could not remove that entry.')
    }
  }

  return (
    <section aria-label="Cooking history" className="mt-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="eyebrow">Cooking history</h2>
        <button
          type="button"
          onClick={log}
          disabled={busy || pending}
          className={button({ variant: 'secondary', size: 'sm' })}
        >
          <CalendarPlus size={15} aria-hidden />
          Log a cook
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-(--color-alert)">{error}</p>}

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-(--color-ink-2)">
          Not cooked yet. Logging a cook here, or from the cooking view, starts the
          history.
        </p>
      ) : (
        <ul className="mt-3 border-t border-(--color-border)">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-baseline gap-3 border-b border-(--color-border) py-2.5"
            >
              <span className="tnum text-sm font-semibold whitespace-nowrap">
                {formatCookDate(new Date(entry.cookedAt))}
              </span>
              {entry.note && (
                <span className="text-sm text-(--color-ink-2)">{entry.note}</span>
              )}
              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label={`Remove cook on ${formatCookDate(new Date(entry.cookedAt))}`}
                className={cn(
                  'ml-auto shrink-0 rounded-[5px] p-1.5 text-(--color-ink-2)',
                  'transition-colors hover:bg-(--color-surface-hi) hover:text-(--color-alert)',
                )}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
