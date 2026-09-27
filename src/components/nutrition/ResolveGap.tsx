'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { button, field } from '@/components/ui'
import { cn } from '@/lib/utils'
import { isWeightUnit } from '@/lib/nutrition/compute'
import { fromDraft, toDraft, type NutrientDraft } from '@/lib/nutrition/format'
import { hasAnyNutrient, type Nutrients } from '@/lib/nutrition/types'
import { NutrientFields } from './NutrientFields'
import { UsdaPicker } from './UsdaPicker'
import { requestJson } from './request'

export interface Gap {
  kind: 'needsNutrition' | 'needsWeight'
  ingredientId: string
  name: string
  /** Canonical, as the estimate reports it; null for a bare count. */
  unit: string | null
}

/** "1 cup of rice", or "1 onion" for a bare count. */
function oneOf(unit: string | null, name: string): string {
  return unit === null ? `1 ${name}` : `1 ${unit} of ${name}`
}

/**
 * One thing the estimate could not find on its own. Whatever the cook enters
 * is stored against the ingredient, so every recipe using it benefits.
 */
export function ResolveGap({
  gap,
  aiConfigured,
  onSaved,
  onDismiss,
}: {
  gap: Gap
  aiConfigured: boolean
  onSaved: () => void
  onDismiss: () => void
}) {
  return (
    <li className="border-t border-(--color-border) py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">
          {gap.kind === 'needsNutrition'
            ? `Nutrition for ${gap.name}`
            : `How much does ${oneOf(gap.unit, gap.name)} weigh?`}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss ${gap.name}`}
          className={button({ variant: 'ghost', size: 'sm' })}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      {gap.kind === 'needsNutrition' ? (
        <NutritionGap gap={gap} aiConfigured={aiConfigured} onSaved={onSaved} />
      ) : (
        <WeightGap gap={gap} onSaved={onSaved} />
      )}
    </li>
  )
}

function NutritionGap({
  gap,
  aiConfigured,
  onSaved,
}: {
  gap: Gap
  aiConfigured: boolean
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<NutrientDraft>(() => toDraft(null))
  /** Still exactly the model's suggestion, so it is saved as `ai`, not `manual`. */
  const [suggested, setSuggested] = useState(false)
  const touched = useRef(false)
  const [per, setPer] = useState<'100g' | 'unit'>('100g')
  const [perGrams, setPerGrams] = useState('')
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canUsePerUnit = !isWeightUnit(gap.unit)

  useEffect(() => {
    if (!aiConfigured) return
    let cancelled = false
    void requestJson<{ nutrients: Nutrients }>('/api/nutrition/suggest', {
      method: 'POST',
      body: { name: gap.name },
    }).then((result) => {
      // A suggestion arriving after the cook started typing would overwrite them.
      if (cancelled || !result.ok || touched.current) return
      setDraft(toDraft(result.data.nutrients))
      setSuggested(true)
    })
    return () => {
      cancelled = true
    }
  }, [aiConfigured, gap.name])

  function edit(next: NutrientDraft) {
    touched.current = true
    setSuggested(false)
    setDraft(next)
  }

  async function send(body: unknown, url = `/api/ingredients/${gap.ingredientId}/nutrition`, method = 'PUT') {
    setBusy(true)
    setError(null)
    const result = await requestJson(url, { method, body })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSaved()
  }

  function save() {
    const nutrients = fromDraft(draft)
    if (nutrients === null) {
      setError('Values must be numbers of zero or more.')
      return
    }
    if (!hasAnyNutrient(nutrients)) {
      setError('Enter at least one value, or leave it blank.')
      return
    }
    let perAmount: { unit: string | null; grams: number } | null = null
    if (per === 'unit') {
      const grams = Number(perGrams)
      if (perGrams.trim() === '' || !Number.isFinite(grams) || grams <= 0) {
        setError(`Enter how many grams ${oneOf(gap.unit, gap.name)} weighs.`)
        return
      }
      perAmount = { unit: gap.unit, grams }
    }
    void send({ source: suggested ? 'ai' : 'manual', nutrients, per: perAmount })
  }

  return (
    <div className="mt-3 space-y-3">
      {suggested && (
        <p className="inline-flex items-center gap-1.5 rounded-[5px] bg-(--color-accent-soft) px-2 py-1 text-xs font-semibold text-(--color-accent)">
          <Sparkles className="size-3.5" aria-hidden />
          AI estimate — check before saving
        </p>
      )}
      {canUsePerUnit && (
        <fieldset className="flex flex-wrap items-center gap-3 text-sm">
          <legend className="sr-only">Values are per</legend>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" checked={per === '100g'} onChange={() => setPer('100g')} />
            Per 100 g
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" checked={per === 'unit'} onChange={() => setPer('unit')} />
            Per {gap.unit ?? gap.name}
          </label>
          {per === 'unit' && (
            <label className="inline-flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                step="any"
                aria-label={`Grams in ${oneOf(gap.unit, gap.name)}`}
                value={perGrams}
                onChange={(event) => setPerGrams(event.target.value)}
                className={cn(field, 'tnum w-20 px-2 py-1 text-sm')}
              />
              g each
            </label>
          )}
        </fieldset>
      )}
      <NutrientFields value={draft} onChange={edit} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={busy} className={button({ size: 'sm' })}>
          Save
        </button>
        <button
          type="button"
          onClick={() => setSearching((open) => !open)}
          disabled={busy}
          className={button({ variant: 'secondary', size: 'sm' })}
        >
          Search USDA
        </button>
        <button
          type="button"
          onClick={() => void send({ source: 'none' })}
          disabled={busy}
          className={button({ variant: 'ghost', size: 'sm' })}
        >
          Leave blank
        </button>
      </div>
      {searching && (
        <UsdaPicker
          initialQuery={gap.name}
          disabled={busy}
          onPick={(food) =>
            void send({ fdcId: food.fdcId }, `/api/ingredients/${gap.ingredientId}/nutrition/usda`, 'POST')
          }
        />
      )}
      {error && <p className="text-sm text-(--color-alert)">{error}</p>}
    </div>
  )
}

function WeightGap({ gap, onSaved }: { gap: Gap; onSaved: () => void }) {
  const [grams, setGrams] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(value: number | null) {
    setBusy(true)
    setError(null)
    const result = await requestJson(`/api/ingredients/${gap.ingredientId}/weights`, {
      method: 'PUT',
      body: { unit: gap.unit, grams: value },
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSaved()
  }

  function save() {
    const value = Number(grams)
    if (grams.trim() === '' || !Number.isFinite(value) || value <= 0) {
      setError('Enter a weight in grams.')
      return
    }
    void send(value)
  }

  return (
    <div className="mt-3 space-y-3">
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="number"
          min={0}
          step="any"
          aria-label={`Grams in ${oneOf(gap.unit, gap.name)}`}
          value={grams}
          onChange={(event) => setGrams(event.target.value)}
          className={cn(field, 'tnum w-24 px-2.5 py-1.5 text-sm')}
        />
        grams
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={busy} className={button({ size: 'sm' })}>
          Save
        </button>
        <button
          type="button"
          onClick={() => void send(null)}
          disabled={busy}
          className={button({ variant: 'ghost', size: 'sm' })}
        >
          Leave blank
        </button>
      </div>
      {error && <p className="text-sm text-(--color-alert)">{error}</p>}
    </div>
  )
}
