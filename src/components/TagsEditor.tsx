'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, X } from 'lucide-react'
import { button, field } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface TagRow {
  id: string
  name: string
  count: number
}

export function TagsEditor({ initial }: { initial: TagRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function startEditing(row: TagRow) {
    setEditing(row.id)
    setDraft(row.name)
    setConfirming(null)
    setError(null)
    setNotice(null)
  }

  /**
   * Renaming onto a name that already exists merges the two tags, so the
   * response is re-read from the server rather than patched locally: a merge
   * changes another row's count as well as removing this one.
   */
  async function rename(row: TagRow) {
    const name = draft.trim()
    if (name === '' || name === row.name) {
      setEditing(null)
      return
    }
    setError(null)
    try {
      const response = await fetch(`/api/tags/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) throw new Error()
      const { outcome } = (await response.json()) as { outcome: string }
      setEditing(null)
      setNotice(
        outcome === 'merged'
          ? `Merged “${row.name}” into “${name}”.`
          : null,
      )
      await refresh()
    } catch {
      setError('Could not rename that tag.')
    }
  }

  async function remove(row: TagRow) {
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/tags/${row.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      setConfirming(null)
      setRows((current) => current.filter((each) => each.id !== row.id))
      // The browse filters are rendered on the server from the same tags.
      router.refresh()
    } catch {
      setError('Could not delete that tag.')
    }
  }

  async function refresh() {
    const response = await fetch('/api/tags')
    if (response.ok) setRows(await response.json())
    router.refresh()
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-(--color-ink-2)">
        No tags yet. They appear here once you tag a recipe.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <ul>
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 border-b border-(--color-border) py-2.5 last:border-b-0"
          >
            {editing === row.id ? (
              <>
                <input
                  autoFocus
                  aria-label={`Rename ${row.name}`}
                  className={cn(field, 'min-w-0 flex-1 py-1.5')}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void rename(row)
                    }
                    if (event.key === 'Escape') setEditing(null)
                  }}
                />
                <button
                  type="button"
                  aria-label={`Save ${row.name}`}
                  onClick={() => void rename(row)}
                  className={button({ variant: 'secondary', size: 'sm' })}
                >
                  <Check className="size-4" aria-hidden />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className={button({ variant: 'ghost', size: 'sm' })}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{row.name}</span>
                {/* The count is what tells a typo from a real category. */}
                <span className="tnum shrink-0 text-[13px] text-(--color-ink-2)">
                  {row.count === 1 ? '1 recipe' : `${row.count} recipes`}
                </span>
                {confirming === row.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void remove(row)}
                      className={cn(
                        button({ size: 'sm' }),
                        'bg-(--color-alert) text-white hover:bg-(--color-alert)',
                      )}
                    >
                      Delete tag
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className={button({ variant: 'ghost', size: 'sm' })}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label={`Rename ${row.name}`}
                      onClick={() => startEditing(row)}
                      className="shrink-0 rounded-full p-1 text-(--color-ink-2) transition-colors hover:text-(--color-ink)"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${row.name}`}
                      onClick={() => {
                        setConfirming(row.id)
                        setError(null)
                        setNotice(null)
                      }}
                      className="shrink-0 rounded-full p-1 text-(--color-ink-2) transition-colors hover:text-(--color-alert)"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {notice !== null && (
        <p role="status" className="text-sm text-(--color-ink-2)">
          {notice}
        </p>
      )}

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
