'use client'

import { useState } from 'react'
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
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0"
                checked={row.checked}
                onChange={(event) => void toggle(row.id, event.target.checked)}
              />
              <span className={cn(row.checked && 'text-(--color-ink-muted) line-through')}>
                <span className="font-medium">
                  {[formatQuantity(row.quantity), row.unit].filter(Boolean).join(' ')}
                </span>{' '}
                {row.name}
                {row.sourceTitles.length > 0 && (
                  <span className="block text-xs text-(--color-ink-muted)">
                    for {row.sourceTitles.join(', ')}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input
          aria-label="Add an item"
          placeholder="Add an item"
          className="min-w-0 flex-1 rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2"
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
          className="rounded-lg border border-(--color-border-subtle) px-4 py-2 font-medium"
        >
          Add
        </button>
      </div>
    </div>
  )
}
