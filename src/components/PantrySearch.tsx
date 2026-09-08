'use client'

import { useState } from 'react'
import { RecipeCard } from './RecipeCard'
import type { CoverageMatch } from '@/lib/db/search'

export function PantrySearch() {
  const [text, setText] = useState('')
  const [matches, setMatches] = useState<CoverageMatch[] | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const names = text
        .split(/[\n,]/)
        .map((part) => part.trim())
        .filter(Boolean)
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ names, minCoverage: 0.5 }),
      })
      const body = await response.json()
      setMatches(body.matches ?? [])
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4">
      <label className="block">
        <span className="font-medium">What do you have?</span>
        <textarea
          aria-label="Ingredients on hand"
          rows={4}
          placeholder="eggs, parmesan, bacon, spaghetti"
          className="mt-2 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || text.trim() === ''}
        onClick={() => void run()}
        className="rounded-lg bg-(--color-accent) px-4 py-2 font-medium text-(--color-accent-ink) disabled:opacity-60"
      >
        {busy ? 'Matching…' : 'What can I make?'}
      </button>

      {matches !== null && matches.length === 0 && (
        <p className="text-(--color-ink-muted)">Nothing comes close with those ingredients.</p>
      )}

      {matches !== null && matches.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {matches.map((match) => (
            <li key={match.recipeId}>
              <RecipeCard
                id={match.recipeId}
                title={match.title}
                prepMinutes={null}
                cookMinutes={null}
                footnote={
                  match.missing.length === 0
                    ? 'You have everything'
                    : `Missing: ${match.missing.join(', ')}`
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
