import { db } from './client'
import { normalizeIngredientName, resolveIngredientsIn, linkAliasIn } from './ingredients'
import type { PrismaClient } from '@/generated/prisma/client'
import type { ParsedIngredient } from '@/lib/parsing/types'

/** The subset of the client shared by `db` and an interactive transaction. */
type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export interface RecipeAlias {
  alias: string
  canonical: string
}

export interface RecipeInput {
  title: string
  description?: string | null
  sourceUrl?: string | null
  prepMinutes?: number | null
  cookMinutes?: number | null
  servings?: number | null
  instructions: string
  /** The cook's own running notes on making this dish. */
  notes?: string | null
  ingredients: ParsedIngredient[]
  tags?: string[]
  /** Alias links confirmed at save time, applied in the same transaction. */
  aliases?: RecipeAlias[]
}

/** Resolves every parsed ingredient to a canonical id, preserving order. */
async function buildIngredientRows(tx: Tx, ingredients: ParsedIngredient[]) {
  const canonical = await resolveIngredientsIn(
    tx,
    ingredients.map((parsed) => parsed.ingredient),
  )
  return ingredients.map((parsed, index) => ({
    ingredientId: canonical.get(normalizeIngredientName(parsed.ingredient))!.id,
    quantity: parsed.quantity,
    unit: parsed.unit,
    note: parsed.note,
    rawText: parsed.rawText,
    sortOrder: index,
  }))
}

/**
 * Upserts each tag and returns their ids. Tag names are unique, so existing
 * rows are read in one query and only the genuinely new ones are created.
 */
async function resolveTagIds(tx: Tx, names: string[]): Promise<string[]> {
  const wanted = [
    ...new Set(names.map((n) => n.trim().toLowerCase()).filter((n) => n !== '')),
  ]
  if (wanted.length === 0) return []

  const existing = await tx.tag.findMany({ where: { name: { in: wanted } } })
  const byName = new Map(existing.map((tag) => [tag.name, tag.id]))

  const missing = wanted.filter((name) => !byName.has(name))
  for (const name of missing) {
    // createMany cannot return ids on SQLite, and a plain create would race
    // against a concurrent save of the same new tag; upsert settles both.
    const tag = await tx.tag.upsert({ where: { name }, create: { name }, update: {} })
    byName.set(name, tag.id)
  }

  return wanted.map((name) => byName.get(name)!)
}

/** Fields written identically by create and update. */
function recipeFields(input: RecipeInput) {
  return {
    title: input.title,
    description: input.description ?? null,
    sourceUrl: input.sourceUrl ?? null,
    prepMinutes: input.prepMinutes ?? null,
    cookMinutes: input.cookMinutes ?? null,
    servings: input.servings ?? null,
    instructions: input.instructions,
    notes: input.notes ?? null,
  }
}

export async function createRecipe(input: RecipeInput): Promise<string> {
  return db.$transaction(async (tx) => {
    // Aliases are linked first so the ingredients below resolve to the
    // canonical rows the user just confirmed -- and inside the transaction so
    // a failed save leaves no orphan alias behind.
    for (const { alias, canonical } of input.aliases ?? []) {
      await linkAliasIn(tx, alias, canonical)
    }

    const rows = await buildIngredientRows(tx, input.ingredients)
    const tagIds = await resolveTagIds(tx, input.tags ?? [])

    const recipe = await tx.recipe.create({
      data: {
        ...recipeFields(input),
        ingredients: { create: rows },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    })
    return recipe.id
  })
}

export async function getRecipe(id: string) {
  return db.recipe.findUnique({
    where: { id },
    include: {
      ingredients: {
        include: { ingredient: true },
        orderBy: { sortOrder: 'asc' },
      },
      tags: { include: { tag: true } },
    },
  })
}

/** Replaces the recipe wholesale, including its ingredient and tag lists. */
export async function updateRecipe(id: string, input: RecipeInput): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const { alias, canonical } of input.aliases ?? []) {
      await linkAliasIn(tx, alias, canonical)
    }

    const rows = await buildIngredientRows(tx, input.ingredients)
    const tagIds = await resolveTagIds(tx, input.tags ?? [])

    await tx.recipeIngredient.deleteMany({ where: { recipeId: id } })
    await tx.recipeTag.deleteMany({ where: { recipeId: id } })
    await tx.recipe.update({
      where: { id },
      data: {
        ...recipeFields(input),
        ingredients: { create: rows },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    })
  })
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.recipe.delete({ where: { id } })
}

/**
 * Stamps the recipe as cooked now. Drives the "Last cooked" sort. Returns
 * null when no such recipe exists, so the caller can answer 404 rather than
 * letting Prisma's not-found error become a 500.
 */
export async function markCooked(id: string): Promise<Date | null> {
  const cookedAt = new Date()
  const { count } = await db.recipe.updateMany({
    where: { id },
    data: { lastCookedAt: cookedAt },
  })
  return count > 0 ? cookedAt : null
}

export type RecipeSort = 'recent' | 'title' | 'time' | 'cooked'

export async function listRecipes(opts: {
  sort?: RecipeSort
  tag?: string
  maxMinutes?: number
} = {}) {
  // Total time is prep + cook and either may be null, which SQLite can express
  // with COALESCE but Prisma's orderBy cannot. Sorting and filtering on it
  // therefore go through a raw query for the ids, and the rows are then loaded
  // with their relations in that order.
  if (opts.sort === 'time' || opts.maxMinutes !== undefined) {
    return listByTotalTime(opts)
  }

  const orderBy =
    opts.sort === 'title'
      ? { title: 'asc' as const }
      : opts.sort === 'cooked'
        ? // Never-cooked recipes sort last rather than leading on NULL.
          [{ lastCookedAt: { sort: 'desc' as const, nulls: 'last' as const } }, { createdAt: 'desc' as const }]
        : { createdAt: 'desc' as const }

  return db.recipe.findMany({
    where: opts.tag ? { tags: { some: { tag: { name: opts.tag } } } } : undefined,
    orderBy,
    include: { tags: { include: { tag: true } } },
  })
}

async function listByTotalTime(opts: { sort?: RecipeSort; tag?: string; maxMinutes?: number }) {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.tag !== undefined) {
    conditions.push(
      `EXISTS (SELECT 1 FROM RecipeTag rt JOIN Tag t ON t.id = rt.tagId
               WHERE rt.recipeId = r.id AND t.name = ?)`,
    )
    params.push(opts.tag)
  }
  if (opts.maxMinutes !== undefined) {
    conditions.push('(COALESCE(r.prepMinutes, 0) + COALESCE(r.cookMinutes, 0)) <= ?')
    params.push(opts.maxMinutes)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const order =
    opts.sort === 'time'
      ? '(COALESCE(r.prepMinutes, 0) + COALESCE(r.cookMinutes, 0)) ASC, r.createdAt DESC'
      : opts.sort === 'title'
        ? 'r.title ASC'
        : opts.sort === 'cooked'
          ? 'r.lastCookedAt IS NULL, r.lastCookedAt DESC, r.createdAt DESC'
          : 'r.createdAt DESC'

  const ids = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT r.id FROM Recipe r ${where} ORDER BY ${order}`,
    ...params,
  )
  if (ids.length === 0) return []

  const rows = await db.recipe.findMany({
    where: { id: { in: ids.map((row) => row.id) } },
    include: { tags: { include: { tag: true } } },
  })
  // findMany does not preserve the id order from the ranking query.
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.map((row) => byId.get(row.id)!).filter((row) => row !== undefined)
}
