import { db } from './client'
import { createRecipe } from './recipes'
import { setRecipePhoto, isPhotoMimeType } from './photos'
import { resolveIngredientsIn, normalizeIngredientName } from './ingredients'
import {
  getNutritionData, setOverride, upsertIngredientNutrition, upsertUnitWeight,
  type IngredientNutritionData, type NutritionOverride, type UnitWeight,
} from './nutrition'
import type { Confidence } from '@/lib/parsing/types'
import {
  NUTRITION_SOURCES, NutrientsSchema, NutritionOverrideSchema, pickNutrients,
  validateNutrientsPer100g, validateUnitWeight, type NutritionSource,
} from '@/lib/nutrition/types'

/**
 * Bumped only when a change would make an older file unreadable. Readers accept
 * anything at or below their own version, so adding an optional field is free.
 */
export const EXPORT_VERSION = 1

export interface ExportedIngredient {
  quantity: number | null
  unit: string | null
  ingredient: string
  note: string | null
  /** The user's original line, verbatim. Never derived, never regenerated. */
  rawText: string
}

export interface ExportedCook {
  cookedAt: string
  note: string | null
}

/**
 * A photo carried inside the JSON document, base64 since JSON has no bytes.
 *
 * Optional on read: a file written before photos existed simply has no field,
 * which is why EXPORT_VERSION does not move for this.
 */
export interface ExportedPhoto {
  data: string
  mimeType: string
}

export interface ExportedRecipe {
  title: string
  description: string | null
  sourceUrl: string | null
  prepMinutes: number | null
  cookMinutes: number | null
  servings: number | null
  instructions: string
  notes: string | null
  lastCookedAt: string | null
  tags: string[]
  ingredients: ExportedIngredient[]
  cookLog: ExportedCook[]
  photo?: ExportedPhoto | null
  /** Per-serving values the cook entered. Optional on read, like `photo`. */
  nutritionOverride?: NutritionOverride | null
}

/**
 * What the app knows about one ingredient's nutrition, keyed by name for the
 * same reason recipes carry no ids. Only whole-corpus exports write these.
 */
export interface ExportedIngredientNutrition {
  name: string
  nutrition: IngredientNutritionData | null
  unitWeights: UnitWeight[]
}

export interface ExportDocument {
  mangia: { version: number; exportedAt?: string }
  recipes: ExportedRecipe[]
  ingredients?: ExportedIngredientNutrition[]
}

/** A single-recipe export is the same document with exactly one recipe in it. */
export interface SingleRecipeDocument extends ExportDocument {
  recipe: ExportedRecipe
}

const RECIPE_INCLUDE = {
  ingredients: { include: { ingredient: true }, orderBy: { sortOrder: 'asc' } },
  tags: { include: { tag: true } },
  cookLogs: { orderBy: { cookedAt: 'desc' } },
  photo: true,
  nutritionOverride: true,
} as const

type RecipeRow = Awaited<
  ReturnType<typeof db.recipe.findMany<{ include: typeof RECIPE_INCLUDE }>>
>[number]

/**
 * Ids are deliberately absent from the serialized form. They are cuids with no
 * meaning outside the database that produced them, and importing into a
 * database that already holds a recipe with that id would either collide or
 * silently overwrite. Recipes are matched by title on the way back in instead.
 */
function serialize(row: RecipeRow): ExportedRecipe {
  return {
    title: row.title,
    description: row.description,
    sourceUrl: row.sourceUrl,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    servings: row.servings,
    instructions: row.instructions,
    notes: row.notes,
    lastCookedAt: row.lastCookedAt?.toISOString() ?? null,
    tags: row.tags.map((link) => link.tag.name),
    ingredients: row.ingredients.map((link) => ({
      quantity: link.quantity,
      unit: link.unit,
      ingredient: link.ingredient.name,
      note: link.note,
      rawText: link.rawText,
    })),
    cookLog: row.cookLogs.map((entry) => ({
      cookedAt: entry.cookedAt.toISOString(),
      note: entry.note,
    })),
    photo: row.photo
      ? {
          data: Buffer.from(row.photo.data).toString('base64'),
          mimeType: row.photo.mimeType,
        }
      : null,
    nutritionOverride: row.nutritionOverride
      ? { ...pickNutrients(row.nutritionOverride), note: row.nutritionOverride.note }
      : null,
  }
}

/** Every ingredient with a nutrition or weight row, by name. */
async function exportIngredientNutrition(): Promise<ExportedIngredientNutrition[]> {
  const ingredients = await db.ingredient.findMany({
    where: { OR: [{ nutrition: { isNot: null } }, { unitWeights: { some: {} } }] },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  const { nutrition, weights } = await getNutritionData(ingredients.map((row) => row.id))
  return ingredients.map((row) => ({
    name: row.name,
    nutrition: nutrition.get(row.id) ?? null,
    unitWeights: weights.get(row.id) ?? [],
  }))
}

/** One recipe, in the same envelope as a full archive so both import alike. */
export async function exportRecipe(id: string): Promise<SingleRecipeDocument | null> {
  const row = await db.recipe.findUnique({ where: { id }, include: RECIPE_INCLUDE })
  if (row === null) return null

  const recipe = serialize(row)
  return {
    mangia: { version: EXPORT_VERSION, exportedAt: new Date().toISOString() },
    recipe,
    recipes: [recipe],
  }
}

/** The whole corpus, oldest first so a re-import preserves creation order. */
export async function exportAll(): Promise<ExportDocument> {
  const rows = await db.recipe.findMany({
    include: RECIPE_INCLUDE,
    orderBy: { createdAt: 'asc' },
  })
  return {
    mangia: { version: EXPORT_VERSION, exportedAt: new Date().toISOString() },
    recipes: rows.map(serialize),
    ingredients: await exportIngredientNutrition(),
  }
}

export interface ImportResult {
  imported: number
  skipped: number
  ids: string[]
}

/** A date that survived JSON, or null if the field was absent or unparseable. */
function readDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Rebuilds a ParsedIngredient from an exported one. Confidence is not exported
 * because it describes how sure the parser was of a line it is no longer
 * parsing -- the line is being restored, not re-read -- so imported rows claim
 * 'high' rather than pretending to a judgement nobody made.
 */
function toParsed(row: ExportedIngredient) {
  return {
    // Never coerce a missing quantity to 0: "salt to taste" has no number.
    quantity: typeof row.quantity === 'number' ? row.quantity : null,
    unit: row.unit ?? null,
    ingredient: row.ingredient,
    note: row.note ?? null,
    rawText: row.rawText ?? row.ingredient,
    confidence: 'high' as Confidence,
  }
}

function assertDocument(doc: ExportDocument): void {
  if (
    doc === null ||
    typeof doc !== 'object' ||
    typeof doc.mangia !== 'object' ||
    doc.mangia === null ||
    !Array.isArray(doc.recipes)
  ) {
    throw new Error('That file is not a Mangia export.')
  }
  if (typeof doc.mangia.version === 'number' && doc.mangia.version > EXPORT_VERSION) {
    throw new Error(
      `That file was written by a newer version of Mangia (format ${doc.mangia.version}).`,
    )
  }
}

/**
 * Imports every recipe in a document. Each is created through createRecipe so
 * ingredient canonicalisation, alias resolution and tag upserts all behave
 * exactly as they do for a hand-typed save -- an import path with its own
 * inserts would drift from that the first time either changed.
 *
 * Recipes are added, never merged: an import cannot tell an edited copy from a
 * different dish with the same name, and losing an edit is worse than a
 * duplicate the user can delete.
 */
export async function importRecipeDocument(doc: ExportDocument): Promise<ImportResult> {
  assertDocument(doc)

  const ids: string[] = []
  let skipped = 0

  for (const entry of doc.recipes) {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      typeof entry.title !== 'string' ||
      entry.title.trim() === ''
    ) {
      skipped += 1
      continue
    }

    const id = await createRecipe({
      title: entry.title,
      description: entry.description ?? null,
      sourceUrl: entry.sourceUrl ?? null,
      prepMinutes: entry.prepMinutes ?? null,
      cookMinutes: entry.cookMinutes ?? null,
      servings: entry.servings ?? null,
      instructions: typeof entry.instructions === 'string' ? entry.instructions : '',
      notes: entry.notes ?? null,
      ingredients: Array.isArray(entry.ingredients) ? entry.ingredients.map(toParsed) : [],
      tags: Array.isArray(entry.tags) ? entry.tags : [],
    })
    ids.push(id)

    const log = Array.isArray(entry.cookLog) ? entry.cookLog : []
    for (const cook of log) {
      const cookedAt = readDate(cook?.cookedAt)
      if (cookedAt === null) continue
      await db.cookLog.create({
        data: { recipeId: id, cookedAt, note: cook.note ?? null },
      })
    }

    // A photo whose type is not one we serve is dropped and the recipe kept.
    // `setRecipePhoto` would throw on it, and losing the rest of someone's
    // restore over one bad row in a file they cannot edit is the wrong trade.
    if (
      entry.photo &&
      typeof entry.photo.data === 'string' &&
      typeof entry.photo.mimeType === 'string' &&
      isPhotoMimeType(entry.photo.mimeType)
    ) {
      await setRecipePhoto(id, Buffer.from(entry.photo.data, 'base64'), entry.photo.mimeType)
    }

    const override = NutritionOverrideSchema.safeParse(entry.nutritionOverride)
    if (override.success) await setOverride(id, override.data)

    // Restored from the file rather than recomputed: a recipe can carry a
    // lastCookedAt from before the log existed, with no entry to derive it from.
    const lastCookedAt = readDate(entry.lastCookedAt)
    if (lastCookedAt !== null) {
      await db.recipe.update({ where: { id }, data: { lastCookedAt } })
    }
  }

  if (Array.isArray(doc.ingredients)) await importIngredientNutrition(doc.ingredients)

  return { imported: ids.length, skipped, ids }
}

function isSource(value: unknown): value is NutritionSource {
  return (NUTRITION_SOURCES as readonly unknown[]).includes(value)
}

/** A stored row may be replaced only when nothing is there or the app gave up. */
function isGap(existing: { source: NutritionSource } | undefined): boolean {
  return existing === undefined || existing.source === 'unmatched'
}

/**
 * Restores ingredient nutrition, filling gaps only. What this database already
 * knows -- a USDA match, a cook's correction -- is at least as current as a
 * backup, so it wins. `unmatched` entries in the file are skipped: they carry
 * no values, and leaving the gap open lets this install try the lookup itself.
 * Anything malformed or implausible is dropped quietly, as a bad photo is.
 */
async function importIngredientNutrition(entries: unknown[]): Promise<void> {
  const valid = entries.filter(
    (entry): entry is ExportedIngredientNutrition =>
      entry !== null &&
      typeof entry === 'object' &&
      typeof (entry as ExportedIngredientNutrition).name === 'string' &&
      normalizeIngredientName((entry as ExportedIngredientNutrition).name) !== '',
  )
  if (valid.length === 0) return

  const resolved = await resolveIngredientsIn(db, valid.map((entry) => entry.name))
  const ingredientIds = valid.map((entry) => resolved.get(normalizeIngredientName(entry.name))!.id)
  const existing = await getNutritionData(ingredientIds)

  for (const [index, entry] of valid.entries()) {
    const ingredientId = ingredientIds[index]

    const nutrition = entry.nutrition
    if (nutrition && isSource(nutrition.source) && nutrition.source !== 'unmatched' &&
        isGap(existing.nutrition.get(ingredientId))) {
      const values = NutrientsSchema.safeParse(nutrition)
      if (values.success && validateNutrientsPer100g(values.data)) {
        await upsertIngredientNutrition(ingredientId, {
          ...values.data,
          source: nutrition.source,
          fdcId: typeof nutrition.fdcId === 'number' ? nutrition.fdcId : null,
          fdcDescription: typeof nutrition.fdcDescription === 'string' ? nutrition.fdcDescription : null,
        })
      }
    }

    const stored = existing.weights.get(ingredientId) ?? []
    for (const weight of Array.isArray(entry.unitWeights) ? entry.unitWeights : []) {
      if (weight === null || typeof weight !== 'object') continue
      const unit = typeof weight.unit === 'string' && weight.unit !== '' ? weight.unit : null
      if (!isSource(weight.source) || weight.source === 'unmatched') continue
      const grams = weight.source === 'none' ? null : weight.grams
      if (grams !== null && (typeof grams !== 'number' || !validateUnitWeight(grams))) continue
      if (!isGap(stored.find((row) => row.unit === unit))) continue
      await upsertUnitWeight(ingredientId, unit, grams, weight.source)
    }
  }
}
