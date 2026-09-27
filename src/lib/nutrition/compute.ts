import { normalizeUnit } from '@/lib/parsing/units'
import type { IngredientNutritionData, NutritionOverride, UnitWeight } from '@/lib/db/nutrition'
import { EMPTY_NUTRIENTS, NUTRIENT_KEYS, pickNutrients, type Nutrients } from './types'

/**
 * Recipe totals, computed on every read from the per-ingredient data. Nothing
 * here touches the network or the database, so the recipe page can render an
 * estimate immediately and the resolver can recompute after each fill.
 */

/** Grams in one of each weight unit. These never need a stored row. */
export const GRAMS_PER_UNIT: Record<string, number> = {
  gram: 1,
  kilogram: 1000,
  ounce: 28.3495,
  pound: 453.592,
}

/**
 * Millilitres in one of each volume unit. US and metric volumes are two groups
 * for summing a shopping list, but for weight they are one: a density learned
 * from "1 cup" answers "250 ml" just as well as "2 tbsp".
 */
export const ML_PER_UNIT: Record<string, number> = {
  teaspoon: 4.92892,
  tablespoon: 14.7868,
  fluidOunce: 29.5735,
  cup: 236.588,
  pint: 473.176,
  quart: 946.353,
  gallon: 3785.41,
  milliliter: 1,
  liter: 1000,
}

/** A unit as the lookups expect it: canonical where recognised, else as typed. */
export function canonicalUnit(unit: string | null): string | null {
  if (unit === null || unit.trim() === '') return null
  return normalizeUnit(unit) ?? unit.trim().toLowerCase()
}

export function isWeightUnit(unit: string | null): boolean {
  return unit !== null && unit in GRAMS_PER_UNIT
}

export type LineStatus =
  | 'counted'
  | 'needsNutrition'
  | 'needsWeight'
  | 'noQuantity'
  | 'blank'
  | 'pending'

export interface ComputeLine {
  recipeIngredientId: string
  ingredientId: string
  name: string
  quantity: number | null
  unit: string | null
}

export interface ComputeInput {
  servings: number | null
  lines: ComputeLine[]
}

export interface NutritionLine {
  recipeIngredientId: string
  ingredientId: string
  name: string
  quantity: number | null
  /** Canonical unit, or null for a bare count. */
  unit: string | null
  grams: number | null
  /** This line's contribution, not per 100 g. */
  nutrients: Nutrients | null
  status: LineStatus
  fdcDescription: string | null
}

export interface RecipeNutrition {
  basis: 'serving' | 'recipe'
  totals: Nutrients
  source: 'override' | 'estimate' | 'none'
  overrideNote: string | null
  lines: NutritionLine[]
  counted: number
  countable: number
  needsInput: number
  pending: boolean
}

type WeightLookup =
  | { kind: 'grams'; gramsPerUnit: number }
  | { kind: 'blank' }
  | { kind: 'unmatched' }
  | { kind: 'missing' }

/**
 * Grams in one `unit` of an ingredient. An exact row wins; for a volume, any
 * other volume row with grams is scaled by the ratio of their sizes. A usable
 * weight anywhere beats a `none` or `unmatched` marker, since the cook filling
 * in "cup" should cover a line in tablespoons that was earlier left unmatched.
 */
export function lookupWeight(unit: string | null, weights: UnitWeight[]): WeightLookup {
  if (unit !== null && unit in GRAMS_PER_UNIT) {
    return { kind: 'grams', gramsPerUnit: GRAMS_PER_UNIT[unit] }
  }
  const exact = weights.find((w) => w.unit === unit)
  if (exact?.grams != null) return { kind: 'grams', gramsPerUnit: exact.grams }

  const related = unit !== null && unit in ML_PER_UNIT
    ? weights.filter((w) => w.unit !== null && w.unit in ML_PER_UNIT)
    : exact ? [exact] : []
  const usable = related.find((w) => w.grams != null)
  if (usable) {
    const density = usable.grams! / ML_PER_UNIT[usable.unit!]
    return { kind: 'grams', gramsPerUnit: density * ML_PER_UNIT[unit!] }
  }
  if (related.some((w) => w.source === 'none')) return { kind: 'blank' }
  if (related.length > 0) return { kind: 'unmatched' }
  return { kind: 'missing' }
}

export function computeRecipeNutrition(
  recipe: ComputeInput,
  nutritionByIngredient: Map<string, IngredientNutritionData>,
  weightsByIngredient: Map<string, UnitWeight[]>,
  override: NutritionOverride | null,
): RecipeNutrition {
  const lines: NutritionLine[] = recipe.lines.map((line) => {
    const unit = canonicalUnit(line.unit)
    const nutrition = nutritionByIngredient.get(line.ingredientId)
    const base = {
      recipeIngredientId: line.recipeIngredientId,
      ingredientId: line.ingredientId,
      name: line.name,
      quantity: line.quantity,
      unit,
      fdcDescription: nutrition?.fdcDescription ?? null,
    }
    if (line.quantity === null || !(line.quantity > 0)) {
      return { ...base, grams: null, nutrients: null, status: 'noQuantity' as const }
    }

    const weight = lookupWeight(unit, weightsByIngredient.get(line.ingredientId) ?? [])
    const grams = weight.kind === 'grams' ? line.quantity * weight.gramsPerUnit : null

    let status: LineStatus
    if (nutrition?.source === 'none' || weight.kind === 'blank') status = 'blank'
    else if (!nutrition || weight.kind === 'missing') status = 'pending'
    else if (nutrition.source === 'unmatched') status = 'needsNutrition'
    else if (weight.kind === 'unmatched') status = 'needsWeight'
    else status = 'counted'

    const nutrients = status === 'counted' ? scale(pickNutrients(nutrition!), grams! / 100) : null
    return { ...base, grams, nutrients, status }
  })

  const countedLines = lines.filter((line) => line.status === 'counted')
  const countable = lines.filter((line) => line.status !== 'noQuantity' && line.status !== 'blank').length
  const needsInput = lines.filter(
    (line) => line.status === 'needsNutrition' || line.status === 'needsWeight',
  ).length
  const pending = lines.some((line) => line.status === 'pending')
  const summary = { lines, counted: countedLines.length, countable, needsInput, pending }

  // The override is entered per serving, so it is shown per serving even for
  // a recipe with no servings count; there is nothing to multiply it by.
  if (override) {
    return {
      ...summary,
      basis: 'serving',
      totals: pickNutrients(override),
      source: 'override',
      overrideNote: override.note,
    }
  }

  const basis = recipe.servings && recipe.servings > 0 ? 'serving' : 'recipe'
  if (countedLines.length === 0) {
    return { ...summary, basis, totals: { ...EMPTY_NUTRIENTS }, source: 'none', overrideNote: null }
  }

  const divisor = basis === 'serving' ? recipe.servings! : 1
  const totals: Nutrients = { ...EMPTY_NUTRIENTS }
  for (const key of NUTRIENT_KEYS) {
    // A nutrient one ingredient lacks is summed over those that have it,
    // rather than blanking the total: USDA's gaps are mostly in minor values
    // like sugar, and an under-count there is better than no figure at all.
    const present = countedLines.filter((line) => line.nutrients![key] !== null)
    if (present.length > 0) {
      totals[key] = present.reduce((sum, line) => sum + line.nutrients![key]!, 0) / divisor
    }
  }
  return { ...summary, basis, totals, source: 'estimate', overrideNote: null }
}

function scale(n: Nutrients, factor: number): Nutrients {
  const result: Nutrients = { ...EMPTY_NUTRIENTS }
  for (const key of NUTRIENT_KEYS) {
    result[key] = n[key] === null ? null : n[key]! * factor
  }
  return result
}
