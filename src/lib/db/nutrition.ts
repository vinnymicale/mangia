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

/**
 * Removes an ingredient's weights of the given sources. A re-match to another
 * USDA food drops the portions taken from the old one, so the resolver fills
 * them again from the new; the cook's own weights are kept.
 */
export async function deleteUnitWeightsBySource(
  ingredientId: string,
  sources: NutritionSource[],
): Promise<void> {
  await db.ingredientUnitWeight.deleteMany({ where: { ingredientId, source: { in: sources } } })
}

export async function ingredientExists(id: string): Promise<boolean> {
  return (await db.ingredient.count({ where: { id } })) > 0
}

export interface IngredientNutritionRow {
  id: string
  name: string
  recipeCount: number
  /** Null when nothing has been looked up yet. */
  nutrition: IngredientNutritionData | null
  weights: UnitWeight[]
}

/**
 * `gaps` is what the app tried and failed at -- an unmatched profile or
 * weight -- which is what the cook is asked to fill. `empty` is never looked
 * up at all.
 */
export type IngredientFilter = 'all' | 'gaps' | 'empty'

/**
 * Every ingredient a recipe uses or that carries nutrition data, by name. An
 * ingredient only ever seen on a shopping list has nothing to estimate and is
 * left out.
 */
export async function listIngredientNutrition(
  filter: IngredientFilter = 'all',
): Promise<IngredientNutritionRow[]> {
  const rows = await db.ingredient.findMany({
    where: {
      OR: [{ recipeIngredients: { some: {} } }, { nutrition: { isNot: null } }],
    },
    include: {
      nutrition: true,
      unitWeights: true,
      recipeIngredients: { select: { recipeId: true } },
    },
    orderBy: { name: 'asc' },
  })

  const list = rows.map((row): IngredientNutritionRow => ({
    id: row.id,
    name: row.name,
    // A recipe listing an ingredient twice still counts once.
    recipeCount: new Set(row.recipeIngredients.map((ri) => ri.recipeId)).size,
    nutrition: row.nutrition
      ? {
          ...pickNutrients(row.nutrition),
          source: row.nutrition.source as NutritionSource,
          fdcId: row.nutrition.fdcId,
          fdcDescription: row.nutrition.fdcDescription,
        }
      : null,
    weights: row.unitWeights
      .map((w) => ({ unit: fromDbUnit(w.unit), grams: w.grams, source: w.source as NutritionSource }))
      .sort((a, b) => (a.unit ?? '').localeCompare(b.unit ?? '')),
  }))

  if (filter === 'gaps') {
    return list.filter((row) =>
      row.nutrition?.source === 'unmatched' || row.weights.some((w) => w.source === 'unmatched'))
  }
  if (filter === 'empty') return list.filter((row) => row.nutrition === null)
  return list
}

/** One ingredient's stored profile and weights, as the ingredient routes answer with. */
export async function getIngredientNutrition(
  ingredientId: string,
): Promise<{ nutrition: IngredientNutritionData | null; weights: UnitWeight[] }> {
  const { nutrition, weights } = await getNutritionData([ingredientId])
  return { nutrition: nutrition.get(ingredientId) ?? null, weights: weights.get(ingredientId) ?? [] }
}
