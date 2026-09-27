import { z } from 'zod'

/**
 * The seven values the app tracks. Energy is kcal, sodium is mg, the rest are
 * grams. Every field is nullable because sources genuinely lack some of them --
 * USDA Foundation foods often have no sugar figure, a recipe page may print
 * only calories -- and a missing value must stay distinguishable from zero.
 */
export interface Nutrients {
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  sugar: number | null
  sodium: number | null
}

export const NUTRIENT_KEYS = [
  'kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium',
] as const satisfies readonly (keyof Nutrients)[]

export type NutrientKey = (typeof NUTRIENT_KEYS)[number]

/** Display labels and units, in NUTRIENT_KEYS order. */
export const NUTRIENT_LABELS: Record<NutrientKey, { label: string; unit: string }> = {
  kcal: { label: 'Calories', unit: 'kcal' },
  protein: { label: 'Protein', unit: 'g' },
  carbs: { label: 'Carbs', unit: 'g' },
  fat: { label: 'Fat', unit: 'g' },
  fiber: { label: 'Fiber', unit: 'g' },
  sugar: { label: 'Sugar', unit: 'g' },
  sodium: { label: 'Sodium', unit: 'mg' },
}

/**
 * Where a stored value came from. `none` is the cook choosing to leave it
 * blank, which is never asked about again; `unmatched` is the app having tried
 * and failed, which shows as a gap for the cook to fill.
 */
export const NUTRITION_SOURCES = ['usda', 'ai', 'manual', 'none', 'unmatched'] as const
export type NutritionSource = (typeof NUTRITION_SOURCES)[number]

export const EMPTY_NUTRIENTS: Nutrients = {
  kcal: null, protein: null, carbs: null, fat: null, fiber: null, sugar: null, sodium: null,
}

const nutrientValue = z.number().finite().nonnegative().nullable().default(null)

/** Seven optional non-negative numbers; absent keys read as null. */
export const NutrientsSchema = z.object({
  kcal: nutrientValue,
  protein: nutrientValue,
  carbs: nutrientValue,
  fat: nutrientValue,
  fiber: nutrientValue,
  sugar: nutrientValue,
  sodium: nutrientValue,
})

export function hasAnyNutrient(n: Nutrients): boolean {
  return NUTRIENT_KEYS.some((key) => n[key] !== null)
}

/** Copies just the seven fields off a row that carries others. */
export function pickNutrients(row: Nutrients): Nutrients {
  return {
    kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat,
    fiber: row.fiber, sugar: row.sugar, sodium: row.sodium,
  }
}

/**
 * Whether a per-100 g profile is physically plausible. Anything failing is
 * treated as unmatched rather than stored: a model or a mis-mapped USDA field
 * producing 4000 kcal per 100 g would otherwise quietly poison every recipe
 * using that ingredient.
 */
export function validateNutrientsPer100g(n: Nutrients): boolean {
  for (const key of NUTRIENT_KEYS) {
    const value = n[key]
    if (value !== null && (!Number.isFinite(value) || value < 0)) return false
  }
  // Pure fat is ~900 kcal per 100 g; nothing edible is denser.
  if (n.kcal !== null && n.kcal > 900) return false
  const macros = (n.protein ?? 0) + (n.carbs ?? 0) + (n.fat ?? 0)
  // A little headroom over 100 for rounding in the source data.
  if (macros > 101) return false
  if (n.carbs !== null) {
    if (n.fiber !== null && n.fiber > n.carbs + 0.5) return false
    if (n.sugar !== null && n.sugar > n.carbs + 0.5) return false
  }
  // Table salt is ~38 758 mg sodium per 100 g.
  if (n.sodium !== null && n.sodium > 40_000) return false
  return true
}

/** One of any unit weighing nothing, or more than 5 kg, is a parse error. */
export function validateUnitWeight(grams: number): boolean {
  return Number.isFinite(grams) && grams > 0 && grams <= 5000
}

/**
 * A recipe's per-serving override as a request carries it. An override with
 * no values at all would hide the estimate behind nothing, so it is refused;
 * clearing is its own request.
 */
export const NutritionOverrideSchema = NutrientsSchema.extend({
  note: z.string().trim().max(200).nullable().default(null)
    .transform((note) => (note === '' ? null : note)),
}).refine(hasAnyNutrient, { message: 'Give at least one value.' })
