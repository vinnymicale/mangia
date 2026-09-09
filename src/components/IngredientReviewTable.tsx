'use client'

import { Trash2, Plus, Sparkles, AlertTriangle } from 'lucide-react'
import { parseQuantity } from '@/lib/parsing/fractions'
import { isLowConfidence, type ParsedIngredient } from '@/lib/parsing/types'
import { button } from '@/components/ui'
import { cn, formatQuantity } from '@/lib/utils'

export interface IngredientReviewTableProps {
  value: ParsedIngredient[]
  onChange: (next: ParsedIngredient[]) => void
  onCleanUp?: (indexes: number[]) => void
  cleaningUp?: boolean
}

/** Compact variant of the shared field, sized for a dense grid of cells. */
const CELL = cn(
  'w-full rounded-md border border-(--color-border) bg-(--color-surface)',
  'px-2 py-1.5 text-sm transition-colors',
  'hover:border-(--color-border-hi) focus:border-(--color-accent) focus:outline-none',
)

export function IngredientReviewTable({
  value,
  onChange,
  onCleanUp,
  cleaningUp = false,
}: IngredientReviewTableProps) {
  const lowIndexes = value.flatMap((row, i) => (isLowConfidence(row) ? [i] : []))

  function update(index: number, patch: Partial<ParsedIngredient>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function addRow() {
    onChange([
      ...value,
      {
        quantity: null, unit: null, ingredient: '', note: null,
        rawText: '', confidence: 'high',
      },
    ])
  }

  return (
    <div className="space-y-3">
      {/* One bordered surface rather than floating rows: this is a table the
          cook proofreads top to bottom, and the columns need naming. */}
      <div className="overflow-hidden rounded-[11px] border border-(--color-border) bg-(--color-surface)">
        <table className="w-full">
          <thead>
            <tr className="border-b border-(--color-border) text-left text-xs text-(--color-ink-2)">
              <th className="border-l-2 border-l-transparent py-2 pr-2 pl-4 font-medium">
                Quantity
              </th>
              <th className="px-2 py-2 font-medium">Unit</th>
              <th className="px-2 py-2 font-medium">Ingredient</th>
              <th className="px-2 py-2 font-medium">Note</th>
              <th className="w-10 py-2 pr-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--color-border)">
          {value.map((row, index) => {
            const needsReview = isLowConfidence(row)
            return (
              <tr
                key={index}
                aria-label={needsReview ? 'Needs review' : undefined}
                className={cn(needsReview && 'bg-(--color-alert-soft)')}
              >
                {/* A marked edge rather than a full wash: the flag belongs on
                    the row, not over the fields the cook has to correct. */}
                <td
                  className={cn(
                    'w-24 border-l-2 py-2 pr-2 pl-4 align-top',
                    needsReview
                      ? 'border-l-(--color-alert)'
                      : 'border-l-transparent',
                  )}
                >
                  <input
                    aria-label={`Quantity for line ${index + 1}`}
                    className={CELL}
                    defaultValue={formatQuantity(row.quantity)}
                    onChange={(event) => {
                      const raw = event.target.value.trim()
                      // An empty field means "unspecified", never zero.
                      update(index, {
                        quantity: raw === '' ? null : parseQuantity(raw),
                      })
                    }}
                  />
                </td>
                <td className="w-28 px-2 py-2 align-top">
                  <input
                    aria-label={`Unit for line ${index + 1}`}
                    className={CELL}
                    defaultValue={row.unit ?? ''}
                    onChange={(event) =>
                      update(index, { unit: event.target.value.trim() || null })
                    }
                  />
                </td>
                <td className="px-2 py-2 align-top">
                  <input
                    aria-label={`Ingredient for line ${index + 1}`}
                    className={CELL}
                    defaultValue={row.ingredient}
                    onChange={(event) =>
                      update(index, { ingredient: event.target.value })
                    }
                  />
                  {row.rawText !== '' && (
                    <p className="mt-1 flex items-center gap-1 truncate px-1 text-xs text-(--color-ink-2)">
                      {needsReview && (
                        <AlertTriangle className="size-3 shrink-0 text-(--color-alert)" aria-hidden />
                      )}
                      {row.rawText}
                    </p>
                  )}
                </td>
                <td className="w-44 px-2 py-2 align-top">
                  <input
                    aria-label={`Note for line ${index + 1}`}
                    className={CELL}
                    defaultValue={row.note ?? ''}
                    onChange={(event) =>
                      update(index, { note: event.target.value.trim() || null })
                    }
                  />
                </td>
                <td className="w-10 py-2 pr-2 align-top">
                  <button
                    type="button"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() => remove(index)}
                    className="rounded-md p-2 text-(--color-ink-2) transition-colors hover:text-(--color-alert)"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            )
          })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className={button({ variant: 'secondary', size: 'sm' })}
        >
          <Plus className="size-4" aria-hidden />
          Add ingredient
        </button>

        {onCleanUp && lowIndexes.length > 0 && (
          <button
            type="button"
            disabled={cleaningUp}
            onClick={() => onCleanUp(lowIndexes)}
            className={button({ size: 'sm' })}
          >
            <Sparkles className="size-4" aria-hidden />
            {cleaningUp
              ? 'Cleaning up…'
              : `Clean up ${lowIndexes.length} ${
                  lowIndexes.length === 1 ? 'line' : 'lines'
                } with AI`}
          </button>
        )}
      </div>
    </div>
  )
}
