'use client'

import { Trash2, Plus, Sparkles, AlertTriangle } from 'lucide-react'
import { parseQuantity } from '@/lib/parsing/fractions'
import { isLowConfidence, type ParsedIngredient } from '@/lib/parsing/types'
import { formatQuantity } from '@/lib/utils'

export interface IngredientReviewTableProps {
  value: ParsedIngredient[]
  onChange: (next: ParsedIngredient[]) => void
  onCleanUp?: (indexes: number[]) => void
  cleaningUp?: boolean
}

const FIELD =
  'w-full rounded-md border border-(--color-border-subtle) bg-(--color-surface-raised) px-2 py-1.5 text-sm focus:border-(--color-accent) focus:outline-none'

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
      <table className="w-full border-separate border-spacing-y-2">
        <thead className="sr-only">
          <tr>
            <th>Quantity</th><th>Unit</th><th>Ingredient</th><th>Note</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {value.map((row, index) => {
            const needsReview = isLowConfidence(row)
            return (
              <tr
                key={index}
                aria-label={needsReview ? 'Needs review' : undefined}
                className={needsReview ? 'bg-amber-500/10' : undefined}
              >
                <td className="w-20 align-top">
                  <input
                    aria-label={`Quantity for line ${index + 1}`}
                    className={FIELD}
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
                <td className="w-24 align-top">
                  <input
                    aria-label={`Unit for line ${index + 1}`}
                    className={FIELD}
                    defaultValue={row.unit ?? ''}
                    onChange={(event) =>
                      update(index, { unit: event.target.value.trim() || null })
                    }
                  />
                </td>
                <td className="align-top">
                  <input
                    aria-label={`Ingredient for line ${index + 1}`}
                    className={FIELD}
                    defaultValue={row.ingredient}
                    onChange={(event) =>
                      update(index, { ingredient: event.target.value })
                    }
                  />
                  {row.rawText !== '' && (
                    <p className="mt-1 flex items-center gap-1 truncate px-1 text-xs text-(--color-ink-muted)">
                      {needsReview && (
                        <AlertTriangle className="size-3 shrink-0 text-amber-600" aria-hidden />
                      )}
                      {row.rawText}
                    </p>
                  )}
                </td>
                <td className="w-40 align-top">
                  <input
                    aria-label={`Note for line ${index + 1}`}
                    className={FIELD}
                    defaultValue={row.note ?? ''}
                    onChange={(event) =>
                      update(index, { note: event.target.value.trim() || null })
                    }
                  />
                </td>
                <td className="w-10 align-top">
                  <button
                    type="button"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() => remove(index)}
                    className="rounded-md p-2 text-(--color-ink-muted) hover:text-red-600"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-lg border border-(--color-border-subtle) px-3 py-2 text-sm font-medium"
        >
          <Plus className="size-4" aria-hidden />
          Add ingredient
        </button>

        {onCleanUp && lowIndexes.length > 0 && (
          <button
            type="button"
            disabled={cleaningUp}
            onClick={() => onCleanUp(lowIndexes)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-(--color-accent) px-3 py-2 text-sm font-medium text-(--color-accent-ink) disabled:opacity-60"
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
