'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { field } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { IngredientNutritionRow } from '@/lib/db/nutrition'
import { formatNutrientValue } from '@/lib/nutrition/format'
import type { NutritionSource } from '@/lib/nutrition/types'
import { IngredientEditor, type IngredientData } from './IngredientEditor'

type Filter = 'all' | 'gaps' | 'empty'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'gaps', label: 'Needs input' },
  { value: 'empty', label: 'No data' },
]

const SOURCE_LABELS: Record<NutritionSource, string> = {
  usda: 'USDA',
  ai: 'AI',
  manual: 'Manual',
  none: 'Blank',
  unmatched: 'Unmatched',
}

/** Mirrors `listIngredientNutrition`'s filters, applied here so switching is instant. */
function matches(row: IngredientNutritionRow, filter: Filter): boolean {
  if (filter === 'gaps') {
    return row.nutrition?.source === 'unmatched' || row.weights.some((w) => w.source === 'unmatched')
  }
  if (filter === 'empty') return row.nutrition === null
  return true
}

function SourceBadge({ source }: { source: NutritionSource | null }) {
  const gap = source === 'unmatched'
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
        gap
          ? 'bg-(--color-alert)/10 text-(--color-alert)'
          : source === null || source === 'none'
            ? 'bg-(--color-surface-hi) text-(--color-ink-2)'
            : 'bg-(--color-accent-soft) text-(--color-accent)',
      )}
    >
      {source === null ? 'No data' : SOURCE_LABELS[source]}
    </span>
  )
}

/**
 * The one place to see and correct what the app knows about each ingredient.
 * A fix here reaches every recipe using it, which is why it lives apart from
 * any one recipe.
 */
export function IngredientNutritionTable({ initial }: { initial: IngredientNutritionRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => matches(row, filter) && row.name.toLowerCase().includes(needle))
  }, [rows, filter, query])

  function update(id: string, data: IngredientData) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...data } : row)))
    router.refresh()
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-(--color-ink-2)">
        No ingredients yet. They appear here once a recipe uses them.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filter" className="flex gap-1">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                'rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-colors',
                filter === value
                  ? 'bg-(--color-accent-soft) font-semibold text-(--color-accent)'
                  : 'text-(--color-ink-2) hover:bg-(--color-surface-hi) hover:text-(--color-ink)',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label="Search ingredients"
          placeholder="Search ingredients…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={cn(field, 'ml-auto w-full py-1.5 text-sm sm:w-60')}
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-(--color-ink-2)">No ingredients match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) text-left text-xs text-(--color-ink-2)">
                <th className="py-2 pr-3 font-semibold">Ingredient</th>
                <th className="px-2 py-2 text-right font-semibold">kcal</th>
                <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">Protein</th>
                <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">Carbs</th>
                <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">Fat</th>
                <th className="px-2 py-2 font-semibold">Source</th>
                <th className="py-2 pl-2 text-right font-semibold">Recipes</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const expanded = open === row.id
                const n = row.nutrition
                return (
                  <Fragment key={row.id}>
                    <tr className={cn('border-b border-(--color-border)', expanded && 'border-b-0')}>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpen(expanded ? null : row.id)}
                          className="flex items-center gap-1.5 text-left font-medium hover:text-(--color-accent)"
                        >
                          <ChevronDown
                            className={cn('size-4 shrink-0 transition-transform', !expanded && '-rotate-90')}
                            aria-hidden
                          />
                          {row.name}
                        </button>
                      </td>
                      <td className="tnum px-2 py-2 text-right">{formatNutrientValue('kcal', n?.kcal ?? null)}</td>
                      <td className="tnum hidden px-2 py-2 text-right sm:table-cell">
                        {formatNutrientValue('protein', n?.protein ?? null)}
                      </td>
                      <td className="tnum hidden px-2 py-2 text-right sm:table-cell">
                        {formatNutrientValue('carbs', n?.carbs ?? null)}
                      </td>
                      <td className="tnum hidden px-2 py-2 text-right sm:table-cell">
                        {formatNutrientValue('fat', n?.fat ?? null)}
                      </td>
                      <td className="px-2 py-2">
                        <SourceBadge source={n?.source ?? null} />
                      </td>
                      <td className="tnum py-2 pl-2 text-right text-(--color-ink-2)">{row.recipeCount}</td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-(--color-border)">
                        <td colSpan={7} className="pt-1 pb-5 pl-6">
                          <IngredientEditor
                            id={row.id}
                            name={row.name}
                            data={{ nutrition: row.nutrition, weights: row.weights }}
                            onChange={(data) => update(row.id, data)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-(--color-ink-2)">Values are per 100 g.</p>
    </div>
  )
}
