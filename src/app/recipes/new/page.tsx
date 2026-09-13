'use client'

import { useState } from 'react'
import { RecipeForm, EMPTY_RECIPE, type RecipeFormValue } from '@/components/RecipeForm'
import type { ParsedIngredient } from '@/lib/parsing/types'
import type { RecipeDraft } from '@/lib/llm/types'
import { PhotoImportTab, type PhotoImportOutcome } from '@/components/PhotoImportTab'
import { PageTitle, button, field } from '@/components/ui'
import { cn } from '@/lib/utils'

type Door = 'choose' | 'form'
type Tab = 'paste' | 'url' | 'photo'

/**
 * The assisted ways into a recipe. Paste leads because it is the fastest path
 * and the one that needs no network; typing it out is the fallback, so it sits
 * below the tabs rather than competing with them.
 */
const TABS: { id: Tab; label: string }[] = [
  { id: 'paste', label: 'Paste ingredients' },
  { id: 'url', label: 'Import URL' },
  { id: 'photo', label: 'From a photo' },
]

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

/**
 * The card the recipe was read from, kept beside the parse so the two can be
 * compared without leaving the page. Open to start, because the first thing a
 * cook does is check the reading against the card; collapsible because once it
 * is checked it is only in the way.
 */
function PhotoSource({ outcome }: { outcome: PhotoImportOutcome }) {
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-(--color-surface-2) px-4 py-3 text-sm text-(--color-ink-2)">
        {outcome.method === 'vision'
          ? 'Read by your configured model. Check it over before saving.'
          : 'Read with on-device text recognition, which is rougher than a model. Expect to correct it.'}
      </p>

      <details open className="rounded-lg border border-(--color-border) px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold">The photo</summary>
        {/* eslint-disable-next-line @next/next/no-img-element -- an object URL
            for a local file, which the image optimiser cannot fetch. */}
        <img
          src={outcome.previewUrl}
          alt="The recipe photo this was read from"
          className="mt-3 max-h-[28rem] rounded-md"
        />
        {outcome.rawText && (
          <>
            <p className="mt-4 text-[13px] font-semibold">What was read</p>
            <pre className="mt-1.5 max-h-56 overflow-auto rounded-md bg-(--color-surface-2) p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {outcome.rawText}
            </pre>
          </>
        )}
      </details>
    </div>
  )
}

export default function NewRecipePage() {
  const [door, setDoor] = useState<Door>('choose')
  const [tab, setTab] = useState<Tab>('paste')
  const [initial, setInitial] = useState<RecipeFormValue>(EMPTY_RECIPE)
  const [blob, setBlob] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Set only on the photo route; it is what the form shows above itself. */
  const [photo, setPhoto] = useState<PhotoImportOutcome | null>(null)

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
        <RecipeForm
          initial={initial}
          above={photo && <PhotoSource outcome={photo} />}
        />
      </>
    )
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <PageTitle lede="Import from a URL, paste an ingredient block, photograph a card, or fill in the details by hand.">
        New recipe
      </PageTitle>

      {/* Tabs rather than stacked cards: the doors are alternatives, so showing
          one at a time is closer to how the choice is actually made. */}
      <div
        role="tablist"
        aria-label="How to add a recipe"
        className="mb-8 flex border-b-2 border-(--color-border)"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`addtab-${id}`}
            aria-selected={tab === id}
            aria-controls={`addpanel-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-0.5 border-b-2 px-5 py-2.5 text-sm transition-colors',
              tab === id
                ? 'border-(--color-accent) font-semibold text-(--color-accent)'
                : 'border-transparent font-medium text-(--color-ink-2) hover:text-(--color-ink)',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'paste' && (
        <section role="tabpanel" id="addpanel-paste" aria-labelledby="addtab-paste">
          <p className="mb-4 text-sm text-(--color-ink-2)">
            One per line. Parsed instantly — nothing leaves your server.
          </p>
          <textarea
            aria-label="Ingredient list"
            rows={7}
            className={cn(field, 'font-mono text-sm leading-relaxed')}
            placeholder={'500g spaghetti\n1kg small clams, cleaned\n4 garlic cloves, thinly sliced…'}
            value={blob}
            onChange={(event) => setBlob(event.target.value)}
          />
          <button
            type="button"
            disabled={blob.trim() === ''}
            onClick={() => void pasteBlob()}
            className={cn(button(), 'mt-5')}
          >
            Parse ingredients
          </button>
        </section>
      )}

      {tab === 'url' && (
        <section role="tabpanel" id="addpanel-url" aria-labelledby="addtab-url">
          <div className="flex flex-wrap gap-2.5">
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
          <p className="mt-3.5 text-[13px] leading-[1.55] text-(--color-ink-2)">
            Structured recipe data is used when the site publishes it; otherwise
            the page is read by your configured model.
          </p>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-(--color-alert-soft) px-4 py-3 text-sm text-(--color-alert)"
            >
              {error}
            </p>
          )}
        </section>
      )}

      {tab === 'photo' && (
        <section role="tabpanel" id="addpanel-photo" aria-labelledby="addtab-photo">
          <PhotoImportTab
            onParsed={(outcome) => {
              setPhoto(outcome)
              setInitial(outcome.value)
              setDoor('form')
            }}
          />
        </section>
      )}

      <button
        type="button"
        onClick={() => setDoor('form')}
        className={cn(button({ variant: 'ghost' }), 'mt-8 px-0')}
      >
        Or type it out from scratch
      </button>
    </div>
  )
}
