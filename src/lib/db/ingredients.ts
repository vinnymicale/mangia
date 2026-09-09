import { db } from './client'
import { categorize } from './categories'
import type { PrismaClient } from '@/generated/prisma/client'

/** The subset of the client shared by `db` and an interactive transaction. */
type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

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
  return resolveIngredientIn(db, name)
}

/** As `resolveIngredient`, against a specific client or transaction. */
export async function resolveIngredientIn(
  tx: Tx,
  name: string,
): Promise<ResolvedIngredient> {
  const resolved = await resolveIngredientsIn(tx, [name])
  return resolved.get(normalizeIngredientName(name))!
}

/**
 * Resolves many names at once, keyed by normalized name. Existing rows and
 * aliases are read in two queries rather than two per ingredient; only names
 * that match neither are created.
 */
export async function resolveIngredientsIn(
  tx: Tx,
  names: string[],
): Promise<Map<string, ResolvedIngredient>> {
  const wanted = [
    ...new Set(names.map(normalizeIngredientName).filter((n) => n !== '')),
  ]
  const resolved = new Map<string, ResolvedIngredient>()
  if (wanted.length === 0) return resolved

  const existing = await tx.ingredient.findMany({ where: { name: { in: wanted } } })
  for (const row of existing) {
    resolved.set(row.name, { id: row.id, name: row.name, isNew: false })
  }

  const unmatched = wanted.filter((name) => !resolved.has(name))
  if (unmatched.length > 0) {
    const aliases = await tx.ingredientAlias.findMany({
      where: { alias: { in: unmatched } },
      include: { ingredient: true },
    })
    for (const row of aliases) {
      resolved.set(row.alias, {
        id: row.ingredient.id,
        name: row.ingredient.name,
        isNew: false,
      })
    }
  }

  for (const name of wanted) {
    if (resolved.has(name)) continue
    // upsert rather than create: a concurrent save of the same new ingredient
    // would otherwise lose the race against the unique index on name.
    const created = await tx.ingredient.upsert({
      where: { name },
      // The aisle is guessed once, at creation, so shopping lists group
      // correctly without a per-render classification pass.
      create: { name, category: categorize(name) },
      update: {},
    })
    resolved.set(name, { id: created.id, name: created.name, isNew: true })
  }

  return resolved
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
  await linkAliasIn(db, alias, canonicalName)
}

/** As `linkAlias`, against a specific client or transaction. */
export async function linkAliasIn(
  tx: Tx,
  alias: string,
  canonicalName: string,
): Promise<void> {
  const normalized = normalizeIngredientName(alias)
  const canonical = await resolveIngredientIn(tx, canonicalName)
  await tx.ingredientAlias.upsert({
    where: { alias: normalized },
    create: { alias: normalized, ingredientId: canonical.id },
    update: { ingredientId: canonical.id },
  })
}

/**
 * Fills in the aisle for ingredients created before categorization existed,
 * or whose name previously matched no keyword. Runs once at boot; rows the
 * classifier still cannot place are left null and simply group under "Other".
 */
export async function backfillCategories(): Promise<number> {
  const uncategorized = await db.ingredient.findMany({
    where: { category: null },
    select: { id: true, name: true },
  })

  let updated = 0
  for (const row of uncategorized) {
    const category = categorize(row.name)
    if (category === null) continue
    await db.ingredient.update({ where: { id: row.id }, data: { category } })
    updated += 1
  }
  return updated
}
