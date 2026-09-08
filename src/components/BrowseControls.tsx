'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const SORTS = [
  { value: 'recent', label: 'Recently added' },
  { value: 'title', label: 'Title' },
  { value: 'time', label: 'Total time' },
  { value: 'cooked', label: 'Last cooked' },
]

export function BrowseControls({ tags }: { tags: string[] }) {
  const router = useRouter()
  const params = useSearchParams()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value === '') next.delete(key)
    else next.set(key, value)
    router.push(next.size === 0 ? '/' : `/?${next.toString()}`)
  }

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <label className="text-sm">
        <span className="sr-only">Sort by</span>
        <select
          aria-label="Sort by"
          className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2"
          value={params.get('sort') ?? 'recent'}
          onChange={(event) => setParam('sort', event.target.value)}
        >
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>{sort.label}</option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="sr-only">Filter by tag</span>
        <select
          aria-label="Filter by tag"
          className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2"
          value={params.get('tag') ?? ''}
          onChange={(event) => setParam('tag', event.target.value)}
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="sr-only">Maximum minutes</span>
        <input
          aria-label="Maximum minutes"
          inputMode="numeric"
          placeholder="Max minutes"
          className="w-32 rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2"
          defaultValue={params.get('maxMinutes') ?? ''}
          onBlur={(event) => setParam('maxMinutes', event.target.value.trim())}
        />
      </label>
    </div>
  )
}
