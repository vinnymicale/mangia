'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { button, field } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface StapleRow {
  id: string
  name: string
}

export function StaplesEditor({ initial }: { initial: StapleRow[] }) {
  const [rows, setRows] = useState(initial)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')

  // The list runs long once a kitchen is described properly, so filtering is
  // how you find a staple rather than scrolling for it.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return rows
    return rows.filter((row) => row.name.includes(needle))
  }, [rows, query])

  async function add() {
    const name = draft.trim()
    if (name === '') return
    setDraft('')
    const response = await fetch('/api/staples', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const staple: StapleRow = await response.json()
    setRows((current) =>
      current.some((row) => row.id === staple.id)
        ? current
        : [...current, staple].sort((a, b) => a.name.localeCompare(b.name)),
    )
  }

  async function remove(id: string) {
    setRows((current) => current.filter((row) => row.id !== id))
    await fetch('/api/staples', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  return (
    <div className="space-y-7">
      {/* Add and filter share the top row, as in the mockup: both are ways of
          getting to a single staple, and neither deserves its own block. */}
      <div className="flex flex-wrap gap-2.5">
        <input
          aria-label="Add a staple"
          placeholder="Add a staple, e.g. olive oil"
          className={cn(field, 'min-w-0 flex-1')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void add()
            }
          }}
        />
        <button
          type="button"
          onClick={() => void add()}
          className={button({ variant: 'primary' })}
        >
          Add
        </button>
      </div>

      {rows.length > 8 && (
        <input
          type="search"
          aria-label="Filter staples"
          placeholder="Filter staples"
          className={cn(field, 'max-w-xs')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-(--color-ink-2)">
          {rows.length === 0
            ? 'No staples yet. Add the things you always have on hand.'
            : `Nothing matches \u201C${query.trim()}\u201D.`}
        </p>
      ) : (
        <ul>
          {visible.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 border-b border-(--color-border) py-2.5 last:border-b-0"
            >
              <span className="flex-1 text-sm">{row.name}</span>
              <button
                type="button"
                aria-label={`Remove ${row.name}`}
                onClick={() => void remove(row.id)}
                className="shrink-0 rounded-full p-1 text-(--color-ink-2) transition-colors hover:text-(--color-alert)"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
