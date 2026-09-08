'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IngredientReviewTable } from './IngredientReviewTable'
import { UnknownIngredientPrompt, type AliasChoice } from './UnknownIngredientPrompt'
import type { ParsedIngredient } from '@/lib/parsing/types'

export interface RecipeFormValue {
  id?: string
  title: string
  description: string | null
  instructions: string
  servings: number | null
  prepMinutes: number | null
  cookMinutes: number | null
  sourceUrl: string | null
  ingredients: ParsedIngredient[]
  tags: string[]
}

export const EMPTY_RECIPE: RecipeFormValue = {
  title: '', description: null, instructions: '', servings: null,
  prepMinutes: null, cookMinutes: null, sourceUrl: null,
  ingredients: [], tags: [],
}

const FIELD =
  'w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2 focus:border-(--color-accent) focus:outline-none'

function toIntOrNull(raw: string): number | null {
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value >= 0 ? value : null
}

export function RecipeForm({ initial }: { initial: RecipeFormValue }) {
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
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <label className="block">
        <span className="text-sm font-medium">Title</span>
        <input
          required
          className={FIELD}
          value={value.title}
          onChange={(event) => patch({ title: event.target.value })}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium">Servings</span>
          <input
            inputMode="numeric"
            className={FIELD}
            defaultValue={value.servings ?? ''}
            onChange={(event) => patch({ servings: toIntOrNull(event.target.value) })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Prep (min)</span>
          <input
            inputMode="numeric"
            className={FIELD}
            defaultValue={value.prepMinutes ?? ''}
            onChange={(event) => patch({ prepMinutes: toIntOrNull(event.target.value) })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cook (min)</span>
          <input
            inputMode="numeric"
            className={FIELD}
            defaultValue={value.cookMinutes ?? ''}
            onChange={(event) => patch({ cookMinutes: toIntOrNull(event.target.value) })}
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Ingredients</legend>
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
        <span className="text-sm font-medium">Instructions</span>
        <textarea
          rows={10}
          className={FIELD}
          value={value.instructions}
          onChange={(event) => patch({ instructions: event.target.value })}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Tags</span>
        <input
          className={FIELD}
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
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || value.title.trim() === ''}
        className="rounded-lg bg-(--color-accent) px-5 py-2.5 font-medium text-(--color-accent-ink) disabled:opacity-60"
      >
        {saving ? 'Saving…' : unknown.length > 0 ? 'Confirm and save' : 'Save recipe'}
      </button>
    </form>
  )
}
