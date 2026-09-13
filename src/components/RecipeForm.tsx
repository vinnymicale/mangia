'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IngredientReviewTable } from './IngredientReviewTable'
import { UnknownIngredientPrompt, type AliasChoice } from './UnknownIngredientPrompt'
import { button, field, label as labelClass } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ParsedIngredient } from '@/lib/parsing/types'

export interface RecipeFormValue {
  id?: string
  title: string
  description: string | null
  instructions: string
  notes: string | null
  servings: number | null
  prepMinutes: number | null
  cookMinutes: number | null
  sourceUrl: string | null
  ingredients: ParsedIngredient[]
  tags: string[]
  /**
   * The photo this recipe was read from, base64, when the cook chose to keep
   * it. Part of the value rather than a separate prop because `save` posts the
   * whole value, so it rides along with no change to the submit path. Ignored
   * on an edit: the API drops it on PUT.
   */
  photo?: { data: string; mimeType: string } | null
}

export const EMPTY_RECIPE: RecipeFormValue = {
  title: '', description: null, instructions: '', notes: null, servings: null,
  prepMinutes: null, cookMinutes: null, sourceUrl: null,
  ingredients: [], tags: [], photo: null,
}

function toIntOrNull(raw: string): number | null {
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * `above` is rendered inside the form, before the first field -- the photo
 * import shows the original card there so the source stays next to what was
 * read from it while the parse is corrected.
 */
export function RecipeForm({
  initial,
  above,
}: {
  initial: RecipeFormValue
  above?: React.ReactNode
}) {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [unknown, setUnknown] = useState<string[]>([])
  const [aliases, setAliases] = useState<AliasChoice[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function patch(next: Partial<RecipeFormValue>) {
    setValue((current) => ({ ...current, ...next }))
  }

  async function cleanUp(indexes: number[]) {
    setCleaningUp(true)
    setError(null)
    try {
      const lines = indexes.map((i) => value.ingredients[i].rawText || value.ingredients[i].ingredient)
      const response = await fetch('/api/clean-ingredients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lines }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Clean-up failed.')

      const next = [...value.ingredients]
      indexes.forEach((target, position) => {
        const cleaned = body.ingredients[position]
        // Keep the original text no matter what the model returned.
        if (cleaned) next[target] = { ...cleaned, rawText: next[target].rawText }
      })
      patch({ ingredients: next })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setCleaningUp(false)
    }
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const names = value.ingredients.map((row) => row.ingredient).filter(Boolean)

      // First save attempt checks the vocabulary; the user confirms, then saves.
      if (unknown.length === 0) {
        const check = await fetch('/api/unknown-ingredients', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ names }),
        })
        const { unknown: found } = await check.json()
        if (found.length > 0) {
          setUnknown(found)
          setSaving(false)
          return
        }
      }

      const response = await fetch(
        value.id ? `/api/recipes/${value.id}` : '/api/recipes',
        {
          method: value.id ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...value, aliases }),
        },
      )
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Save failed.')
      router.push(`/recipes/${value.id ?? body.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-7"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      {above}

      <label className="block max-w-2xl">
        <span className={labelClass}>Title</span>
        <input
          required
          className={cn(field, 'mt-1.5')}
          value={value.title}
          onChange={(event) => patch({ title: event.target.value })}
        />
      </label>

      {/* The description is what the browse card shows under the title, so it
          needs to be editable here rather than only ever set by an import. */}
      <label className="block max-w-2xl">
        <span className={labelClass}>Description</span>
        <textarea
          rows={3}
          placeholder="A short, appetizing description…"
          className={cn(field, 'mt-1.5 leading-relaxed')}
          value={value.description ?? ''}
          onChange={(event) =>
            patch({ description: event.target.value === '' ? null : event.target.value })
          }
        />
      </label>

      <div className="grid max-w-xl gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={labelClass}>Servings</span>
          <input
            inputMode="numeric"
            className={cn(field, 'mt-1.5')}
            defaultValue={value.servings ?? ''}
            onChange={(event) => patch({ servings: toIntOrNull(event.target.value) })}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Prep (min)</span>
          <input
            inputMode="numeric"
            className={cn(field, 'mt-1.5')}
            defaultValue={value.prepMinutes ?? ''}
            onChange={(event) => patch({ prepMinutes: toIntOrNull(event.target.value) })}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Cook (min)</span>
          <input
            inputMode="numeric"
            className={cn(field, 'mt-1.5')}
            defaultValue={value.cookMinutes ?? ''}
            onChange={(event) => patch({ cookMinutes: toIntOrNull(event.target.value) })}
          />
        </label>
      </div>

      <fieldset>
        <legend className={labelClass}>Ingredients</legend>
        <div className="mt-2">
          <IngredientReviewTable
            value={value.ingredients}
            onChange={(ingredients) => patch({ ingredients })}
            onCleanUp={(indexes) => void cleanUp(indexes)}
            cleaningUp={cleaningUp}
          />
        </div>
      </fieldset>

      <label className="block">
        <span className={labelClass}>Instructions</span>
        <textarea
          rows={10}
          className={cn(field, 'mt-1.5')}
          value={value.instructions}
          onChange={(event) => patch({ instructions: event.target.value })}
        />
      </label>

      {/* Notes are the cook's own record -- what they changed, what to do
          differently next time -- so they sit apart from the method rather
          than being folded into it. */}
      <label className="block">
        <span className={labelClass}>Notes</span>
        <textarea
          rows={4}
          placeholder="Halved the salt. Needed 10 more minutes…"
          className={cn(field, 'mt-1.5 leading-relaxed')}
          value={value.notes ?? ''}
          onChange={(event) =>
            patch({ notes: event.target.value === '' ? null : event.target.value })
          }
        />
      </label>

      <label className="block">
        <span className={labelClass}>Tags</span>
        <input
          className={cn(field, 'mt-1.5')}
          placeholder="weeknight, pasta"
          defaultValue={value.tags.join(', ')}
          onChange={(event) =>
            patch({
              tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean),
            })
          }
        />
      </label>

      <UnknownIngredientPrompt unknown={unknown} choices={aliases} onChange={setAliases} />

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-(--color-alert-soft) px-4 py-3 text-sm text-(--color-alert)"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || value.title.trim() === ''}
        className={button({ size: 'lg' })}
      >
        {saving ? 'Saving…' : unknown.length > 0 ? 'Confirm and save' : 'Save recipe'}
      </button>
    </form>
  )
}
