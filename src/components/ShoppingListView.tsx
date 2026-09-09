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
  sourceTitles: string[]
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

  async function toggle(id: string, checked: boolean) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, checked } : row)),
    )
    await fetch(`/api/lists/${listId}/items`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: id, checked }),
    })
  }

  async function add() {
    const name = draft.trim()
    if (name === '') return
    setDraft('')
    const response = await fetch(`/api/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const item = await response.json()
    setRows((current) => [
      ...current,
      { ...item, sourceTitles: [], checked: false },
    ])
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-(--color-border) rounded-[11px] border border-(--color-border) bg-(--color-surface)">
        {rows.map((row, index) => {
          // Items arrive grouped by recipe, so repeating the same source on
          // every row is noise. Print it once, where the run starts.
          const source = row.sourceTitles.join(', ')
          const repeat =
            source !== '' && source === rows[index - 1]?.sourceTitles.join(', ')
          return (
            <li key={row.id}>
              {/* A full-width row: in a shop this is tapped one-handed. */}
              <label
                className={cn(
                  'flex cursor-pointer items-baseline gap-3 px-5 py-2.5 transition-colors',
                  row.checked
                    ? 'bg-(--color-accent-soft)'
                    : 'hover:bg-(--color-accent-soft)/60',
                )}
              >
                <input
                  type="checkbox"
                  className="size-5 shrink-0 self-center"
                  checked={row.checked}
                  onChange={(event) =>
                    void toggle(row.id, event.target.checked)
                  }
                />
                {/* The source recipes sit out on the right: they answer "why is
                  this on the list?", which is secondary to the item itself. */}
                <span
                  className={cn(
                    'flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 transition-colors',
                    row.checked && 'text-(--color-ink-2) line-through',
                  )}
                >
                  {/* The measure gets a fixed column so a list of amounts
                      lines up down one edge while shopping. */}
                  <span className="flex min-w-0 items-baseline gap-3">
                    <span className="tnum w-18 shrink-0 text-right text-sm font-semibold text-(--color-accent)">
                      {[formatQuantity(row.quantity), row.unit]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                    {row.name}
                  </span>
                  {source !== '' && !repeat && (
                    <span className="text-[11px] text-(--color-ink-2)">
                      for {source}
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

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
    </div>
  )
}
