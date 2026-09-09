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
  const active = params.get('tag') ?? ''

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value === '') next.delete(key)
    else next.set(key, value)
    router.push(next.size === 0 ? '/' : `/?${next.toString()}`)
  }

  return (
    <div className="mb-7 space-y-3">
      {/* Tags are the filter people reach for most, so they get the whole row
          as one-tap chips rather than being buried in a dropdown. */}
      <div className="flex flex-wrap gap-[7px]">
        {[{ value: '', label: 'All' }, ...tags.map((tag) => ({ value: tag, label: tag }))].map(
          ({ value, label }) => {
            const on = value === active
            return (
              <button
                key={value || '__all'}
                type="button"
                aria-pressed={on}
                onClick={() => setParam('tag', value)}
                className={cn(
                  'rounded-full border px-3.5 py-[5px] text-[11px] font-semibold tracking-[0.06em] uppercase transition-colors',
                  on
                    ? 'border-(--color-accent) bg-(--color-accent) text-(--color-accent-ink)'
                    : 'border-(--color-border) text-(--color-ink-2) hover:border-(--color-accent) hover:text-(--color-accent)',
                )}
              >
                {label}
              </button>
            )
          },
        )}
      </div>

      {/* Sort and time cap have no chip equivalent -- they are ranges and
          orderings, not membership -- so they stay as a quieter second row. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          label="Sort by"
          options={SORTS}
          value={params.get('sort') ?? 'recent'}
          onChange={(value) => setParam('sort', value)}
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
    </div>
  )
}
