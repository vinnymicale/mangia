'use client'

import { useState } from 'react'
import { RecipeForm, EMPTY_RECIPE, type RecipeFormValue } from '@/components/RecipeForm'
import type { ParsedIngredient } from '@/lib/parsing/types'
import type { RecipeDraft } from '@/lib/llm/types'

type Door = 'choose' | 'form'

function draftToForm(draft: RecipeDraft, sourceUrl: string | null): RecipeFormValue {
  return {
    ...EMPTY_RECIPE,
    title: draft.title,
    description: draft.description,
    instructions: draft.instructions,
    servings: draft.servings,
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    sourceUrl,
    tags: draft.tags,
    ingredients: draft.ingredients.map((row) => ({
      ...row,
      rawText: [row.quantity ?? '', row.unit ?? '', row.ingredient].join(' ').trim(),
      confidence: 'high' as const,
    })),
  }
}

export default function NewRecipePage() {
  const [door, setDoor] = useState<Door>('choose')
  const [initial, setInitial] = useState<RecipeFormValue>(EMPTY_RECIPE)
  const [blob, setBlob] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pasteBlob() {
    const response = await fetch('/api/parse-ingredients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: blob }),
    })
    const body = await response.json()
    setInitial({ ...EMPTY_RECIPE, ingredients: body.ingredients as ParsedIngredient[] })
    setDoor('form')
  }

  async function importUrl() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Import failed.')
      setInitial(draftToForm(body.draft as RecipeDraft, body.sourceUrl))
      setDoor('form')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  if (door === 'form') {
    return (
      <>
        <h1 className="mb-6 text-2xl font-semibold">New recipe</h1>
        <RecipeForm initial={initial} />
      </>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">New recipe</h1>

      <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-4">
        <h2 className="font-medium">Paste your ingredients</h2>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          One per line. Parsed instantly — nothing leaves your server.
        </p>
        <textarea
          aria-label="Ingredient list"
          rows={6}
          className="mt-3 w-full rounded-lg border border-(--color-border-subtle) bg-transparent px-3 py-2 font-mono text-sm"
          value={blob}
          onChange={(event) => setBlob(event.target.value)}
        />
        <button
          type="button"
          disabled={blob.trim() === ''}
          onClick={() => void pasteBlob()}
          className="mt-3 rounded-lg bg-(--color-accent) px-4 py-2 font-medium text-(--color-accent-ink) disabled:opacity-60"
        >
          Parse ingredients
        </button>
      </section>

      <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-4">
        <h2 className="font-medium">Import from a link</h2>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Structured recipe data is used when the site publishes it; otherwise
          the page is read by your configured model.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            aria-label="Recipe URL"
            type="url"
            placeholder="https://…"
            className="min-w-0 flex-1 rounded-lg border border-(--color-border-subtle) bg-transparent px-3 py-2"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button
            type="button"
            disabled={busy || url.trim() === ''}
            onClick={() => void importUrl()}
            className="rounded-lg bg-(--color-accent) px-4 py-2 font-medium text-(--color-accent-ink) disabled:opacity-60"
          >
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      <button
        type="button"
        onClick={() => setDoor('form')}
        className="text-sm font-medium text-(--color-ink-muted) underline"
      >
        Or type it out from scratch
      </button>
    </div>
  )
}
