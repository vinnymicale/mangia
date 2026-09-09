'use client'

import { useState } from 'react'
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
    <div className="space-y-6">
      <ul className="flex flex-wrap gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-2 rounded-full bg-(--color-accent-soft) py-1.5 pr-2 pl-3.5 text-sm text-(--color-accent)"
          >
            {row.name}
            <button
              type="button"
              aria-label={`Remove ${row.name}`}
              onClick={() => void remove(row.id)}
              className="rounded-full transition-colors hover:text-(--color-alert)"
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
