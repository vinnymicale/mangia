'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { field } from '@/components/ui'
import { Select } from '@/components/Select'

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
    <div className="mb-8 flex flex-wrap items-center gap-2.5">
      <Select
        label="Sort by"
        options={SORTS}
        value={params.get('sort') ?? 'recent'}
        onChange={(value) => setParam('sort', value)}
      />

      <Select
        label="Tag"
        name="Filter by tag"
        options={[
          { value: '', label: 'All tags' },
          ...tags.map((tag) => ({ value: tag, label: tag })),
        ]}
        value={params.get('tag') ?? ''}
        onChange={(value) => setParam('tag', value)}
      />

      <label>
        <span className="sr-only">Maximum minutes</span>
        <input
          aria-label="Maximum minutes"
          inputMode="numeric"
          placeholder="Max minutes"
          className={cn(field, 'w-32 py-2 text-sm')}
          defaultValue={params.get('maxMinutes') ?? ''}
          onBlur={(event) => setParam('maxMinutes', event.target.value.trim())}
        />
      </label>
    </div>
  )
}
