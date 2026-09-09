'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { button } from '@/components/ui'
import { cn, formatQuantity } from '@/lib/utils'

export interface CookingIngredient {
  id: string
  quantity: number | null
  unit: string | null
  name: string
  note: string | null
}

export interface CookingViewProps {
  recipeId: string
  title: string
  ingredients: CookingIngredient[]
  steps: string[]
  /** The cook's own notes, already split into paragraphs. Empty when none. */
  notes: string[]
  /** Set when the recipe has been cooked before, for the button's caption. */
  lastCookedAt: string | null
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

/**
 * Remembers whether the notes panel is collapsed, per recipe.
 *
 * Hiding notes is a decision about this dish -- "I already know to halve the
 * salt" -- not a global preference, so the choice is keyed by recipe id. It
 * starts open: notes only exist because the cook wrote them for this moment.
 * Storage is read in an effect rather than during render so the server and the
 * first client paint agree.
 */
function useNotesOpen(recipeId: string) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(notesKey(recipeId)) !== 'closed')
    } catch {
      // Private browsing and blocked storage just mean the default sticks.
    }
  }, [recipeId])

  function toggleOpen() {
    setOpen((current) => {
      const next = !current
      try {
        window.localStorage.setItem(notesKey(recipeId), next ? 'open' : 'closed')
      } catch {
        // Not worth interrupting the cook over.
      }
      return next
    })
  }

  return [open, toggleOpen] as const
}

function notesKey(recipeId: string): string {
  return `mangia:cook-notes-open:${recipeId}`
}

/** "3 Feb 2026" -- short enough to sit under the button. */
function formatCookedOn(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function CookingView({
  recipeId,
  title,
  ingredients,
  steps,
  notes,
  lastCookedAt,
}: CookingViewProps) {
  useWakeLock()
  const [notesOpen, toggleNotes] = useNotesOpen(recipeId)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [cookedAt, setCookedAt] = useState(lastCookedAt)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Writes the cook date. Nothing else records it, so without this the
   * "Last cooked" sort on the browse page would never have anything to sort by.
   */
  async function markCooked() {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/recipes/${recipeId}/cooked`, { method: 'POST' })
      if (!response.ok) throw new Error()
      const body: { lastCookedAt: string } = await response.json()
      setCookedAt(body.lastCookedAt)
    } catch {
      setError('Could not record that. Try again.')
    } finally {
      setSaving(false)
    }
  }

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

      {/* Notes sit above the method because they change how the method is
          run -- "halved the salt" is only useful before the salt goes in.
          They collapse because on a familiar dish that advice is already
          absorbed, and the screen at the stove is worth more than the
          reminder. Nothing renders at all when there are no notes. */}
      {notes.length > 0 && (
        <section className="-mt-4 rounded-[11px] border border-(--color-border) bg-(--color-surface)">
          <h2>
            <button
              type="button"
              onClick={toggleNotes}
              aria-expanded={notesOpen}
              aria-controls="cooking-notes"
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-lg font-bold sm:px-5"
            >
              Notes
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-5 shrink-0 text-(--color-ink-2) transition-transform',
                  notesOpen && 'rotate-180',
                )}
              />
            </button>
          </h2>
          <div id="cooking-notes" hidden={!notesOpen} className="space-y-3.5 px-4 pb-4 sm:px-5 sm:pb-5">
            {notes.map((note, index) => (
              <p key={index} className="leading-relaxed text-(--color-ink-2)">
                {note}
              </p>
            ))}
          </div>
        </section>
      )}

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

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => void markCooked()}
          disabled={saving}
          className={button({ size: 'lg' })}
        >
          <Check className="size-5" aria-hidden />
          {cookedAt === null ? 'Mark as cooked' : 'Cooked again'}
        </button>
        {cookedAt !== null && (
          <p className="text-sm text-(--color-ink-2)">
            Last cooked {formatCookedOn(cookedAt)}
          </p>
        )}
        {error !== null && (
          <p
            role="alert"
            className="rounded-lg bg-(--color-alert-soft) px-4 py-3 text-sm text-(--color-alert)"
          >
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
