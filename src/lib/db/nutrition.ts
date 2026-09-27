import { db } from './client'
import { pickNutrients, type Nutrients, type NutritionSource } from '@/lib/nutrition/types'

/**
 * The bare-count unit ("2 eggs") as stored. SQLite treats NULLs as distinct in
 * a unique index, so a null unit would let duplicate rows through
 * `@@unique([ingredientId, unit])`; the empty string keeps the key unique and
 * is translated back to null at this boundary.
 */
const BARE_COUNT = ''

function toDbUnit(unit: string | null): string {
  return unit ?? BARE_COUNT
}

function fromDbUnit(unit: string): string | null {
  return unit === BARE_COUNT ? null : unit
}

export interface IngredientNutritionData extends Nutrients {
  source: NutritionSource
  fdcId: number | null
  fdcDescription: string | null
}

export interface UnitWeight {
  /** Canonical unit, or null for a bare count. */
  unit: string | null
  /** Grams per one unit; null when the cook chose `none` or it is `unmatched`. */
  grams: number | null
  source: NutritionSource
}

export interface NutritionOverride extends Nutrients {
  note: string | null
}

/** Stored nutrition and unit weights for a set of ingredients, in two queries. */
export async function getNutritionData(ingredientIds: string[]): Promise<{
  nutrition: Map<string, IngredientNutritionData>
  weights: Map<string, UnitWeight[]>
}> {
  const ids = [...new Set(ingredientIds)]
  const [nutritionRows, weightRows] = await Promise.all([
    db.ingredientNutrition.findMany({ where: { ingredientId: { in: ids } } }),
    db.ingredientUnitWeight.findMany({ where: { ingredientId: { in: ids } } }),
  ])

  const nutrition = new Map<string, IngredientNutritionData>()
  for (const row of nutritionRows) {
    nutrition.set(row.ingredientId, {
      ...pickNutrients(row),
      source: row.source as NutritionSource,
      fdcId: row.fdcId,
      fdcDescription: row.fdcDescription,
    })
  }

  const weights = new Map<string, UnitWeight[]>()
  for (const row of weightRows) {
    const list = weights.get(row.ingredientId) ?? []
    list.push({ unit: fromDbUnit(row.unit), grams: row.grams, source: row.source as NutritionSource })
    weights.set(row.ingredientId, list)
  }

  return { nutrition, weights }
}

export async function upsertIngredientNutrition(
  ingredientId: string,
  data: IngredientNutritionData,
): Promise<void> {
  const fields = {
    ...pickNutrients(data),
    source: data.source,
    fdcId: data.fdcId,
    fdcDescription: data.fdcDescription,
  }
  await db.ingredientNutrition.upsert({
    where: { ingredientId },
    create: { ingredientId, ...fields },
    update: fields,
  })
}

export async function upsertUnitWeight(
  ingredientId: string,
  unit: string | null,
  grams: number | null,
  source: NutritionSource,
): Promise<void> {
  const key = { ingredientId, unit: toDbUnit(unit) }
  await db.ingredientUnitWeight.upsert({
    where: { ingredientId_unit: key },
    create: { ...key, grams, source },
    update: { grams, source },
  })
}

/** Removes a stored weight so the resolver tries that unit again. */
export async function deleteUnitWeight(ingredientId: string, unit: string | null): Promise<boolean> {
  const { count } = await db.ingredientUnitWeight.deleteMany({
    where: { ingredientId, unit: toDbUnit(unit) },
  })
  return count > 0
}

export async function getOverride(recipeId: string): Promise<NutritionOverride | null> {
  const row = await db.recipeNutritionOverride.findUnique({ where: { recipeId } })
  return row ? { ...pickNutrients(row), note: row.note } : null
}

export async function setOverride(recipeId: string, data: NutritionOverride): Promise<void> {
  const fields = { ...pickNutrients(data), note: data.note }
  await db.recipeNutritionOverride.upsert({
    where: { recipeId },
    create: { recipeId, ...fields },
    update: fields,
  })
}

export async function clearOverride(recipeId: string): Promise<boolean> {
  const { count } = await db.recipeNutritionOverride.deleteMany({ where: { recipeId } })
  return count > 0
}
