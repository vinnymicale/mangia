'use client'

import { useId, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { button, field } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { IngredientNutritionData, UnitWeight } from '@/lib/db/nutrition'
import { fromDraft, toDraft } from '@/lib/nutrition/format'
import { hasAnyNutrient } from '@/lib/nutrition/types'
import { NutrientFields } from './NutrientFields'
import { UsdaPicker } from './UsdaPicker'
import { requestJson } from './request'

export interface IngredientData {
  nutrition: IngredientNutritionData | null
  weights: UnitWeight[]
}

/** "1 clove", or "1 each" for the bare count ("2 eggs"). */
export function unitLabel(unit: string | null): string {
  return `1 ${unit ?? 'each'}`
}

/**
 * Everything stored about one ingredient: its per-100 g profile and the weight
 * of each unit recipes measure it by. Every save answers with the fresh data,
 * handed up through `onChange` so the table row shows it at once.
 */
export function IngredientEditor({
  id,
  name,
  data,
  onChange,
}: {
  id: string
  name: string
  data: IngredientData
  onChange: (data: IngredientData) => void
}) {
  const [draft, setDraft] = useState(() => toDraft(data.nutrition))
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function send(url: string, init: { method: string; body?: unknown }, done: string) {
    setBusy(true)
    setError(null)
    setStatus(null)
    const result = await requestJson<IngredientData>(url, init)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return false
    }
    onChange(result.data)
    setStatus(done)
    return result.data
  }

  async function saveValues() {
    const nutrients = fromDraft(draft)
    if (!nutrients) {
      setError('Each value must be a number of 0 or more.')
      return
    }
    if (!hasAnyNutrient(nutrients)) {
      setError('Give at least one value, or leave it blank.')
      return
    }
    await send(`/api/ingredients/${id}/nutrition`, {
      method: 'PUT', body: { source: 'manual', nutrients, per: null },
    }, 'Saved.')
  }

  async function leaveBlank() {
    const next = await send(`/api/ingredients/${id}/nutrition`, {
      method: 'PUT', body: { source: 'none' },
    }, 'Left blank. Recipes will not count it.')
    if (next) setDraft(toDraft(null))
  }

  async function matchUsda(fdcId: number, done: string) {
    const next = await send(`/api/ingredients/${id}/nutrition/usda`, { method: 'POST', body: { fdcId } }, done)
    if (next) {
      setDraft(toDraft(next.nutrition))
      setPicking(false)
    }
  }

  const fdcId = data.nutrition?.fdcId ?? null

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="eyebrow">Per 100 g</h3>
          {data.nutrition?.fdcDescription && (
            <p className="text-xs text-(--color-ink-2)">
              USDA match: {data.nutrition.fdcDescription}
            </p>
          )}
        </div>
        <NutrientFields value={draft} onChange={setDraft} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveValues()}
            disabled={busy}
            className={button({ size: 'sm' })}
          >
            Save values
          </button>
          <button
            type="button"
            onClick={() => setPicking((open) => !open)}
            aria-expanded={picking}
            disabled={busy}
            className={button({ variant: 'secondary', size: 'sm' })}
          >
            Match to USDA food
          </button>
          {fdcId !== null && data.nutrition?.source !== 'usda' && (
            <button
              type="button"
              onClick={() => void matchUsda(fdcId, 'Reset to the USDA values.')}
              disabled={busy}
              className={button({ variant: 'secondary', size: 'sm' })}
            >
              Reset to USDA
            </button>
          )}
          {data.nutrition?.source !== 'none' && (
            <button
              type="button"
              onClick={() => void leaveBlank()}
              disabled={busy}
              className={button({ variant: 'ghost', size: 'sm' })}
            >
              Leave blank
            </button>
          )}
        </div>
        {picking && (
          <UsdaPicker
            initialQuery={name}
            disabled={busy}
            onPick={(food) => void matchUsda(food.fdcId, `Matched to ${food.description}.`)}
          />
        )}
      </section>

      <UnitWeights
        weights={data.weights}
        busy={busy}
        onSave={(unit, grams) =>
          send(`/api/ingredients/${id}/weights`, { method: 'PUT', body: { unit, grams } }, 'Weight saved.')}
        onDelete={(unit) =>
          send(
            `/api/ingredients/${id}/weights${unit === null ? '' : `?unit=${encodeURIComponent(unit)}`}`,
            { method: 'DELETE' },
            'Weight removed. The next estimate looks it up again.',
          )}
      />

      {error && <p role="alert" className="text-sm text-(--color-alert)">{error}</p>}
      {status && <p className="text-sm text-(--color-ink-2)">{status}</p>}
    </div>
  )
}

function weightNote(weight: UnitWeight): string | null {
  if (weight.source === 'none') return 'Left blank'
  if (weight.source === 'unmatched') return 'Not found'
  if (weight.source === 'usda') return 'USDA'
  if (weight.source === 'ai') return 'AI'
  return null
}

function UnitWeights({
  weights,
  busy,
  onSave,
  onDelete,
}: {
  weights: UnitWeight[]
  busy: boolean
  onSave: (unit: string | null, grams: number) => Promise<unknown>
  onDelete: (unit: string | null) => Promise<unknown>
}) {
  const [newUnit, setNewUnit] = useState('')
  const [newGrams, setNewGrams] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const id = useId()

  async function add() {
    const grams = Number(newGrams)
    if (newGrams.trim() === '' || !Number.isFinite(grams) || grams <= 0) {
      setAddError('Give the weight in grams.')
      return
    }
    setAddError(null)
    const unit = newUnit.trim() === '' ? null : newUnit.trim()
    if (await onSave(unit, grams)) {
      setNewUnit('')
      setNewGrams('')
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="eyebrow">Unit weights</h3>
      {weights.length === 0 ? (
        <p className="text-sm text-(--color-ink-2)">
          None yet. Weights are filled in as recipes need them.
        </p>
      ) : (
        <ul className="divide-y divide-(--color-border) rounded-[7px] border border-(--color-border)">
          {weights.map((weight) => (
            <WeightRow
              key={weight.unit ?? ''}
              weight={weight}
              busy={busy}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`${id}-unit`} className="text-xs font-semibold text-(--color-ink-2)">
            Unit
          </label>
          <input
            id={`${id}-unit`}
            value={newUnit}
            onChange={(event) => setNewUnit(event.target.value)}
            placeholder="clove, cup, or blank for each"
            className={cn(field, 'mt-1 w-56 px-2.5 py-1.5 text-sm')}
          />
        </div>
        <div>
          <label htmlFor={`${id}-grams`} className="text-xs font-semibold text-(--color-ink-2)">
            Grams
          </label>
          <input
            id={`${id}-grams`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={newGrams}
            onChange={(event) => setNewGrams(event.target.value)}
            className={cn(field, 'tnum mt-1 w-24 px-2.5 py-1.5 text-sm')}
          />
        </div>
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy}
          className={button({ variant: 'secondary', size: 'sm' })}
        >
          Add weight
        </button>
      </div>
      {addError && <p className="text-sm text-(--color-alert)">{addError}</p>}
    </section>
  )
}

function WeightRow({
  weight,
  busy,
  onSave,
  onDelete,
}: {
  weight: UnitWeight
  busy: boolean
  onSave: (unit: string | null, grams: number) => Promise<unknown>
  onDelete: (unit: string | null) => Promise<unknown>
}) {
  const [grams, setGrams] = useState(weight.grams === null ? '' : String(weight.grams))
  const value = Number(grams)
  const valid = grams.trim() !== '' && Number.isFinite(value) && value > 0
  const changed = valid && value !== weight.grams
  const note = weightNote(weight)
  const label = unitLabel(weight.unit)

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="min-w-24 flex-1 text-sm">
        {label}
        {note && <span className="ml-2 text-xs text-(--color-ink-2)">{note}</span>}
      </span>
      <input
        aria-label={`Grams in ${label}`}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={grams}
        onChange={(event) => setGrams(event.target.value)}
        className={cn(field, 'tnum w-24 px-2.5 py-1 text-sm')}
      />
      <span className="text-sm text-(--color-ink-2)">g</span>
      <button
        type="button"
        onClick={() => void onSave(weight.unit, value)}
        disabled={busy || !changed}
        className={button({ variant: 'secondary', size: 'sm' })}
      >
        Save
      </button>
      <button
        type="button"
        aria-label={`Remove weight for ${label}`}
        onClick={() => void onDelete(weight.unit)}
        disabled={busy}
        className={button({ variant: 'ghost', size: 'sm' })}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  )
}
