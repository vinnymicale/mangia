import { db } from './client'

/** Canonical form used for uniqueness: lowercased, whitespace-collapsed. */
export function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export interface ResolvedIngredient {
  id: string
  name: string
  isNew: boolean
}

/**
 * Finds an ingredient by name or alias, creating it when absent.
 * `isNew` tells the caller to offer an alias link in the save confirmation.
 */
export async function resolveIngredient(
  name: string,
): Promise<ResolvedIngredient> {
  const normalized = normalizeIngredientName(name)

  const existing = await db.ingredient.findUnique({ where: { name: normalized } })
  if (existing) {
    return { id: existing.id, name: existing.name, isNew: false }
  }

  const alias = await db.ingredientAlias.findUnique({
    where: { alias: normalized },
    include: { ingredient: true },
  })
  if (alias) {
    return { id: alias.ingredient.id, name: alias.ingredient.name, isNew: false }
  }

  const created = await db.ingredient.create({ data: { name: normalized } })
  return { id: created.id, name: created.name, isNew: true }
}

/** Returns the subset of names that match no ingredient and no alias. */
export async function findUnknownNames(names: string[]): Promise<string[]> {
  const normalized = names.map(normalizeIngredientName)

  const known = await db.ingredient.findMany({
    where: { name: { in: normalized } },
    select: { name: true },
  })
  const aliased = await db.ingredientAlias.findMany({
    where: { alias: { in: normalized } },
    select: { alias: true },
  })

  const seen = new Set([
    ...known.map((k) => k.name),
    ...aliased.map((a) => a.alias),
  ])
  return normalized.filter((n) => !seen.has(n))
}

/**
 * Point `alias` at the canonical ingredient named `canonicalName`, creating
 * that ingredient if it does not exist yet. The UI collects a name, not an
 * id, so the resolution belongs here rather than in every caller.
 */
export async function linkAlias(
  alias: string,
  canonicalName: string,
): Promise<void> {
  const normalized = normalizeIngredientName(alias)
  const canonical = await resolveIngredient(canonicalName)
  await db.ingredientAlias.upsert({
    where: { alias: normalized },
    create: { alias: normalized, ingredientId: canonical.id },
    update: { ingredientId: canonical.id },
  })
}
