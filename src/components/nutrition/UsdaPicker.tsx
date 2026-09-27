'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { button, field } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { UsdaSearchResult } from '@/lib/nutrition/usda'
import { requestJson } from './request'

/**
 * Searches FoodData Central and hands back the food the cook picks. Used where
 * the automatic match found nothing, or found the wrong thing.
 */
export function UsdaPicker({
  initialQuery,
  onPick,
  disabled,
}: {
  initialQuery: string
  onPick: (result: UsdaSearchResult) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<UsdaSearchResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    if (query.trim() === '') return
    setBusy(true)
    setError(null)
    const result = await requestJson<{ results: UsdaSearchResult[] }>(
      `/api/nutrition/usda-search?q=${encodeURIComponent(query.trim())}`,
    )
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setResults(result.data.results)
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          aria-label="Search USDA foods"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void search()
            }
          }}
          className={cn(field, 'px-2.5 py-1.5 text-sm')}
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={busy || disabled}
          className={button({ variant: 'secondary', size: 'sm' })}
        >
          <Search className="size-3.5" aria-hidden />
          {busy ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-(--color-alert)">{error}</p>}
      {results !== null && results.length === 0 && (
        <p className="mt-2 text-sm text-(--color-ink-2)">No foods found.</p>
      )}
      {results !== null && results.length > 0 && (
        <ul className="mt-2 max-h-56 overflow-y-auto rounded-[7px] border border-(--color-border)">
          {results.map((food) => (
            <li key={food.fdcId} className="border-b border-(--color-border) last:border-b-0">
              <button
                type="button"
                onClick={() => onPick(food)}
                disabled={disabled}
                className="w-full px-3 py-2 text-left text-sm hover:bg-(--color-surface-hi) disabled:opacity-55"
              >
                {food.description}
                <span className="ml-2 text-xs text-(--color-ink-2)">{food.dataType}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
