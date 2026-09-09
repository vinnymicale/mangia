'use client'

import { useState } from 'react'
import { RecipeCard } from './RecipeCard'
import { button, field, label as labelClass } from '@/components/ui'
import { cn } from '@/lib/utils'
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
    <section>
      <label className="block max-w-2xl">
        <span className={labelClass}>What do you have?</span>
        <textarea
          aria-label="Ingredients on hand"
          rows={2}
          placeholder="eggs, parmesan, bacon, spaghetti"
          className={cn(field, 'mt-2')}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || text.trim() === ''}
        onClick={() => void run()}
        className={cn(button({ size: 'lg' }), 'mt-4')}
      >
        {busy ? 'Matching…' : 'What can I make?'}
      </button>

      {matches !== null && matches.length === 0 && (
        <p className="mt-6 text-(--color-ink-2)">
          Nothing comes close with those ingredients.
        </p>
      )}

      {matches !== null && matches.length > 0 && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <li key={match.recipeId}>
              <RecipeCard
                id={match.recipeId}
                title={match.title}
                prepMinutes={null}
                cookMinutes={null}
                subtitle={`${match.haveCount} of ${match.totalCount} ingredients`}
                coverage={
                  match.totalCount === 0
                    ? 0
                    : match.haveCount / match.totalCount
                }
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
