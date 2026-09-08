import { db } from './client'
import { resolveIngredient } from './ingredients'
import type { ParsedIngredient } from '@/lib/parsing/types'

export interface RecipeInput {
  title: string
  description?: string | null
  sourceUrl?: string | null
  imagePath?: string | null
  prepMinutes?: number | null
  cookMinutes?: number | null
  servings?: number | null
  instructions: string
  notes?: string | null
  ingredients: ParsedIngredient[]
  tags?: string[]
}

/** Resolves every parsed ingredient to a canonical id, preserving order. */
async function buildIngredientRows(ingredients: ParsedIngredient[]) {
  const rows = []
  for (const [index, parsed] of ingredients.entries()) {
    const canonical = await resolveIngredient(parsed.ingredient)
    rows.push({
      ingredientId: canonical.id,
      quantity: parsed.quantity,
      unit: parsed.unit,
      note: parsed.note,
      rawText: parsed.rawText,
      sortOrder: index,
    })
  }
  return rows
}

async function resolveTagIds(names: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const raw of names) {
    const name = raw.trim().toLowerCase()
    if (name === '') continue
    const tag = await db.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    })
    ids.push(tag.id)
  }
  return ids
}

export async function createRecipe(input: RecipeInput): Promise<string> {
  const rows = await buildIngredientRows(input.ingredients)
  const tagIds = await resolveTagIds(input.tags ?? [])

  const recipe = await db.recipe.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      sourceUrl: input.sourceUrl ?? null,
      imagePath: input.imagePath ?? null,
      prepMinutes: input.prepMinutes ?? null,
      cookMinutes: input.cookMinutes ?? null,
      servings: input.servings ?? null,
      instructions: input.instructions,
      notes: input.notes ?? null,
      ingredients: { create: rows },
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
    },
  })
  return recipe.id
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
  const rows = await buildIngredientRows(input.ingredients)
  const tagIds = await resolveTagIds(input.tags ?? [])

  await db.$transaction([
    db.recipeIngredient.deleteMany({ where: { recipeId: id } }),
    db.recipeTag.deleteMany({ where: { recipeId: id } }),
    db.recipe.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description ?? null,
        sourceUrl: input.sourceUrl ?? null,
        imagePath: input.imagePath ?? null,
        prepMinutes: input.prepMinutes ?? null,
        cookMinutes: input.cookMinutes ?? null,
        servings: input.servings ?? null,
        instructions: input.instructions,
        notes: input.notes ?? null,
        ingredients: { create: rows },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    }),
  ])
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.recipe.delete({ where: { id } })
}

export type RecipeSort = 'recent' | 'title' | 'time' | 'cooked'

export async function listRecipes(opts: {
  sort?: RecipeSort
  tag?: string
  maxMinutes?: number
} = {}) {
  const orderBy =
    opts.sort === 'title'
      ? { title: 'asc' as const }
      : opts.sort === 'cooked'
        ? { lastCookedAt: 'desc' as const }
        : { createdAt: 'desc' as const }

  const recipes = await db.recipe.findMany({
    where: opts.tag
      ? { tags: { some: { tag: { name: opts.tag } } } }
      : undefined,
    orderBy,
    include: { tags: { include: { tag: true } } },
  })

  // Total time is prep + cook, and either may be null, so it is filtered
  // in application code rather than SQL.
  if (opts.maxMinutes === undefined) return recipes
  return recipes.filter(
    (r) => (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) <= opts.maxMinutes!,
  )
}
