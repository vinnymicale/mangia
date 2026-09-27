'use client'

import { useState } from 'react'
import { button, field } from '@/components/ui'
import { cn } from '@/lib/utils'
import { fromDraft, toDraft } from '@/lib/nutrition/format'
import { hasAnyNutrient, type Nutrients } from '@/lib/nutrition/types'
import type { RecipeNutrition } from '@/lib/nutrition/compute'
import { NutrientFields } from './NutrientFields'
import { requestJson } from './request'

/**
 * Per-serving values entered by hand, shown in place of the estimate: for a
 * recipe whose source printed its own figures, or one the estimate gets wrong.
 */
export function OverrideEditor({
  recipeId,
  current,
  note: initialNote,
  onSaved,
}: {
  recipeId: string
  /** The override in force, or null to start empty. */
  current: Nutrients | null
  note: string | null
  onSaved: (nutrition: RecipeNutrition) => void
}) {
  const [draft, setDraft] = useState(() => toDraft(current))
  const [note, setNote] = useState(initialNote ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(method: 'PUT' | 'DELETE', body?: unknown) {
    setBusy(true)
    setError(null)
    const result = await requestJson<RecipeNutrition>(`/api/recipes/${recipeId}/nutrition/override`, {
      method,
      body,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSaved(result.data)
  }

  function save() {
    const nutrients = fromDraft(draft)
    if (nutrients === null) {
      setError('Values must be numbers of zero or more.')
      return
    }
    if (!hasAnyNutrient(nutrients)) {
      setError('Enter at least one value.')
      return
    }
    void send('PUT', { ...nutrients, note: note.trim() === '' ? null : note.trim() })
  }

  return (
    <div className="mt-4 space-y-3 rounded-[9px] border border-(--color-border) p-4">
      <p className="text-sm font-semibold">Per-serving values</p>
      <NutrientFields value={draft} onChange={setDraft} />
      <div>
        <label htmlFor={`override-note-${recipeId}`} className="text-xs font-semibold text-(--color-ink-2)">
          Note
        </label>
        <input
          id={`override-note-${recipeId}`}
          value={note}
          maxLength={200}
          placeholder="Where these came from"
          onChange={(event) => setNote(event.target.value)}
          className={cn(field, 'mt-1 px-2.5 py-1.5 text-sm')}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={busy} className={button({ size: 'sm' })}>
          Save override
        </button>
        {current !== null && (
          <button
            type="button"
            onClick={() => void send('DELETE')}
            disabled={busy}
            className={button({ variant: 'ghost', size: 'sm' })}
          >
            Clear override
          </button>
        )}
      </div>
      {error && <p className="text-sm text-(--color-alert)">{error}</p>}
    </div>
  )
}
