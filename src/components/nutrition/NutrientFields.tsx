'use client'

import { useId } from 'react'
import { field } from '@/components/ui'
import { cn } from '@/lib/utils'
import { NUTRIENT_KEYS, NUTRIENT_LABELS, type NutrientKey } from '@/lib/nutrition/types'
import type { NutrientDraft } from '@/lib/nutrition/format'

/** The seven values as a compact grid of labelled number inputs. */
export function NutrientFields({
  value,
  onChange,
  className,
}: {
  value: NutrientDraft
  onChange: (next: NutrientDraft) => void
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-4', className)}>
      {NUTRIENT_KEYS.map((key: NutrientKey) => (
        <div key={key}>
          <label htmlFor={`${id}-${key}`} className="text-xs font-semibold text-(--color-ink-2)">
            {NUTRIENT_LABELS[key].label} ({NUTRIENT_LABELS[key].unit})
          </label>
          <input
            id={`${id}-${key}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={value[key]}
            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
            className={cn(field, 'tnum mt-1 px-2.5 py-1.5 text-sm')}
          />
        </div>
      ))}
    </div>
  )
}
