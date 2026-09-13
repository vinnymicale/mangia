import { db } from './client'
import { createRecipe } from './recipes'
import { setRecipePhoto, isPhotoMimeType } from './photos'
import type { Confidence } from '@/lib/parsing/types'

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
}

export interface ExportDocument {
  mangia: { version: number; exportedAt?: string }
  recipes: ExportedRecipe[]
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
  }
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

    // Restored from the file rather than recomputed: a recipe can carry a
    // lastCookedAt from before the log existed, with no entry to derive it from.
    const lastCookedAt = readDate(entry.lastCookedAt)
    if (lastCookedAt !== null) {
      await db.recipe.update({ where: { id }, data: { lastCookedAt } })
    }
  }

  return { imported: ids.length, skipped, ids }
}
