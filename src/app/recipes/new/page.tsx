'use client'

import { useState } from 'react'
import { RecipeForm, EMPTY_RECIPE, type RecipeFormValue } from '@/components/RecipeForm'
import type { ParsedIngredient } from '@/lib/parsing/types'
import type { RecipeDraft } from '@/lib/llm/types'
import { PageTitle, button, card, field } from '@/components/ui'
import { cn } from '@/lib/utils'

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
        <PageTitle>New recipe</PageTitle>
        <RecipeForm initial={initial} />
      </>
    )
  }

  return (
    <div>
      <PageTitle lede="Three ways in. Pick whichever matches what you have in front of you.">
        New recipe
      </PageTitle>

      <section className={cn(card, 'p-6')}>
        <h2 className="text-xl font-bold">Paste your ingredients</h2>
        <p className="mt-1.5 text-sm text-(--color-ink-2)">
          One per line. Parsed instantly — nothing leaves your server.
        </p>
        <textarea
          aria-label="Ingredient list"
          rows={6}
          className={cn(field, 'mt-4 font-mono text-sm')}
          value={blob}
          onChange={(event) => setBlob(event.target.value)}
        />
        <button
          type="button"
          disabled={blob.trim() === ''}
          onClick={() => void pasteBlob()}
          className={cn(button(), 'mt-4')}
        >
          Parse ingredients
        </button>
      </section>

      <section className={cn(card, 'mt-6 p-6')}>
        <h2 className="text-xl font-bold">Import from a link</h2>
        <p className="mt-1.5 text-sm text-(--color-ink-2)">
          Structured recipe data is used when the site publishes it; otherwise
          the page is read by your configured model.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            aria-label="Recipe URL"
            type="url"
            placeholder="https://…"
            className={cn(field, 'min-w-0 flex-1')}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button
            type="button"
            disabled={busy || url.trim() === ''}
            onClick={() => void importUrl()}
            className={button()}
          >
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-(--color-alert-soft) px-4 py-3 text-sm text-(--color-alert)">
            {error}
          </p>
        )}
      </section>

      <button
        type="button"
        onClick={() => setDoor('form')}
        className={cn(button({ variant: 'ghost' }), 'mt-6')}
      >
        Or type it out from scratch
      </button>
    </div>
  )
}
