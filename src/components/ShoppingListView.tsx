'use client'

import { useState } from 'react'
import { button, field } from '@/components/ui'
import { cn, formatQuantity } from '@/lib/utils'

export interface ShoppingItemView {
  id: string
  name: string
  quantity: number | null
  unit: string | null
  checked: boolean
  note: string | null
  category: string | null
  sourceTitles: string[]
}

/** Uncategorised items sort last, under a heading of their own. */
const UNGROUPED = 'Other'

/**
 * Groups rows under their ingredient category, preserving the order the list
 * itself is in. The mockup shops by aisle -- produce together, dairy together
 * -- which is the order a person actually walks a shop in.
 */
function byCategory(rows: ShoppingItemView[]): [string, ShoppingItemView[]][] {
  const groups = new Map<string, ShoppingItemView[]>()
  for (const row of rows) {
    const key = row.category ?? UNGROUPED
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }
  // Manually added items have no category; they belong at the end rather than
  // wherever the first one happened to land.
  return [...groups.entries()].sort(([a], [b]) =>
    a === UNGROUPED ? 1 : b === UNGROUPED ? -1 : 0,
  )
}

export function ShoppingListView({
  listId,
  items,
}: {
  listId: string
  items: ShoppingItemView[]
}) {
  const [rows, setRows] = useState(items)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  /**
   * The checkbox updates optimistically -- ticking things off should feel
   * instant while shopping -- and reverts if the write did not land, so the
   * box never shows a state the server disagrees with.
   */
  async function toggle(id: string, checked: boolean) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, checked } : row)),
    )
    setError(null)
    try {
      const response = await fetch(`/api/lists/${listId}/items`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: id, checked }),
      })
      if (!response.ok) throw new Error()
    } catch {
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, checked: !checked } : row)),
      )
      setError('Could not save that change.')
    }
  }

  async function add() {
    const name = draft.trim()
    if (name === '') return
    setError(null)
    try {
      const response = await fetch(`/api/lists/${listId}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) throw new Error()
      const item: ShoppingItemView = await response.json()
      // The draft is cleared only once the item exists, so a failed add leaves
      // what was typed in the box to retry.
      setDraft('')
      setRows((current) => [...current, { ...item, sourceTitles: [] }])
    } catch {
      setError('Could not add that item.')
    }
  }

  return (
    <div className="space-y-6">
      {/* One card, divided into aisle sections -- the mockup's .list-card. */}
      <div className="overflow-hidden rounded-[12px] border border-(--color-border) bg-(--color-surface) shadow-(--shadow-card)">
        {byCategory(rows).map(([category, group], groupIndex) => (
          <section
            key={category}
            className={cn(
              'py-1.5',
              groupIndex > 0 && 'border-t border-(--color-border)',
            )}
          >
            <h2 className="eyebrow px-6 pt-3 pb-1.5">{category}</h2>
            <ul>
              {group.map((row) => {
                const source = row.sourceTitles.join(', ')
                return (
                  <li key={row.id}>
                    {/* A full-width row: in a shop this is tapped one-handed. */}
                    <label className="flex cursor-pointer items-center gap-3.5 px-6 py-2.5 transition-colors hover:bg-(--color-accent-soft)">
                      <input
                        type="checkbox"
                        className="size-[17px] shrink-0 cursor-pointer"
                        checked={row.checked}
                        onChange={(event) =>
                          void toggle(row.id, event.target.checked)
                        }
                      />
                      {/* The measure gets a fixed column so a list of amounts
                          lines up down one edge while shopping. */}
                      <span className="tnum w-18 shrink-0 text-right text-[13px] font-semibold text-(--color-accent)">
                        {[formatQuantity(row.quantity), row.unit]
                          .filter(Boolean)
                          .join(' ')}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 text-sm transition-colors',
                          row.checked && 'text-(--color-ink-2) line-through',
                        )}
                      >
                        {row.name}
                      </span>
                      {/* Why this is on the list -- secondary to the item, so
                          it sits out on the right rather than inline. */}
                      {source !== '' && (
                        <span className="ml-auto shrink-0 text-[11px] text-(--color-ink-2)">
                          {source}
                        </span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex max-w-md gap-2">
        <input
          aria-label="Add an item"
          placeholder="Add an item"
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
          className={button({ variant: 'secondary' })}
        >
          Add
        </button>
      </div>

      {error !== null && (
        <p
          role="alert"
          className="rounded-lg bg-(--color-alert-soft) px-4 py-3 text-sm text-(--color-alert)"
        >
          {error}
        </p>
      )}
    </div>
  )
}
