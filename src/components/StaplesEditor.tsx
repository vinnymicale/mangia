'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export interface StapleRow {
  id: string
  name: string
}

export function StaplesEditor({ initial }: { initial: StapleRow[] }) {
  const [rows, setRows] = useState(initial)
  const [draft, setDraft] = useState('')

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
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-2 rounded-full border border-(--color-border-subtle) px-3 py-1"
          >
            {row.name}
            <button
              type="button"
              aria-label={`Remove ${row.name}`}
              onClick={() => void remove(row.id)}
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input
          aria-label="Add a staple"
          placeholder="olive oil"
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
