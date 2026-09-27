import { NUTRIENT_KEYS, NUTRIENT_LABELS, type NutrientKey, type Nutrients } from './types'
import type { RecipeNutrition } from './compute'

/**
 * An estimate is only as good as its weakest guess, so it is shown without
 * false precision: whole kcal and mg, and grams to one place only below ten,
 * where the decimal still says something.
 */
export function formatNutrientValue(key: NutrientKey, value: number | null): string {
  if (value === null) return '—'
  if (key === 'kcal' || key === 'sodium' || value >= 10) return String(Math.round(value))
  return String(Math.round(value * 10) / 10)
}

/** "640 kcal", "38 g", or "—" for a value no source had. */
export function formatNutrient(key: NutrientKey, value: number | null): string {
  if (value === null) return '—'
  return `${formatNutrientValue(key, value)} ${NUTRIENT_LABELS[key].unit}`
}

/** Form fields hold text; this is the round trip, with blank meaning "no value". */
export type NutrientDraft = Record<NutrientKey, string>

export function toDraft(n: Nutrients | null): NutrientDraft {
  const draft = {} as NutrientDraft
  for (const key of NUTRIENT_KEYS) {
    const value = n?.[key] ?? null
    draft[key] = value === null ? '' : String(Math.round(value * 100) / 100)
  }
  return draft
}

/** Null when any field is not a non-negative number. */
export function fromDraft(draft: NutrientDraft): Nutrients | null {
  const n = {} as Nutrients
  for (const key of NUTRIENT_KEYS) {
    const text = draft[key].trim()
    if (text === '') {
      n[key] = null
      continue
    }
    const value = Number(text)
    if (!Number.isFinite(value) || value < 0) return null
    n[key] = value
  }
  return n
}

const MACRO_LINE_KEYS = ['kcal', 'protein', 'carbs', 'fat'] as const

/**
 * The one-line summary a printed card carries: "≈ 640 kcal · 38 g protein ·
 * 52 g carbs · 28 g fat per serving". The "≈" marks an estimate; values the
 * cook entered are printed as given. Null when there is nothing to print.
 */
export function formatMacroLine(nutrition: RecipeNutrition): string | null {
  if (nutrition.source === 'none') return null
  const parts = MACRO_LINE_KEYS.flatMap((key) => {
    const value = nutrition.totals[key]
    if (value === null) return []
    const amount = formatNutrient(key, value)
    return [key === 'kcal' ? amount : `${amount} ${NUTRIENT_LABELS[key].label.toLowerCase()}`]
  })
  if (parts.length === 0) return null
  const basis = nutrition.basis === 'serving' ? 'per serving' : 'for the whole recipe'
  return `${nutrition.source === 'estimate' ? '≈ ' : ''}${parts.join(' · ')} ${basis}`
}
