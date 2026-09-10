import { db } from './client'
import { resolveIngredient, findUnknownNames } from './ingredients'
import {
  normalizeUnit,
  areUnitsCompatible,
  UNIT_BASE_FACTORS,
} from '@/lib/parsing/units'

export interface MergeRow {
  ingredientId: string
  name: string
  category: string | null
  quantity: number | null
  unit: string | null
  recipeId: string
  rawText: string
}

export interface MergedItem {
  ingredientId: string
  name: string
  category: string | null
  quantity: number | null
  unit: string | null
  sourceRecipeIds: string[]
  rawTexts: string[]
}

/**
 * Groups rows by ingredient and by unit compatibility. Quantities are
 * converted to the first-seen unit of their group; units from different
 * groups (volume vs. weight) are never converted and stay separate.
 */
export function mergeIngredients(rows: MergeRow[]): MergedItem[] {
  interface Bucket extends MergedItem {
    baseUnit: string | null
  }
  const buckets: Bucket[] = []

  for (const row of rows) {
    // normalizeUnit returns null for tokens it does not recognize, which would
    // otherwise pool every unknown unit -- and genuinely unitless rows -- into
    // one bucket and sum them. Unknown units keep their own identity instead,
    // so they only ever merge with an identical unknown unit.
    const unit = normalizeRow(row.unit)

    const bucket = buckets.find(
      (candidate) =>
        candidate.ingredientId === row.ingredientId &&
        (candidate.baseUnit === null || unit === null
          ? candidate.baseUnit === unit
          : areUnitsCompatible(candidate.baseUnit, unit)),
    )

    if (!bucket) {
      buckets.push({
        ingredientId: row.ingredientId,
        name: row.name,
        category: row.category,
        quantity: row.quantity,
        unit,
        baseUnit: unit,
        sourceRecipeIds: [row.recipeId],
        rawTexts: [row.rawText],
      })
      continue
    }

    if (row.quantity !== null) {
      const converted = convertQuantity(row.quantity, unit, bucket.baseUnit)
      bucket.quantity = (bucket.quantity ?? 0) + converted
    }
    if (!bucket.sourceRecipeIds.includes(row.recipeId)) {
      bucket.sourceRecipeIds.push(row.recipeId)
    }
    bucket.rawTexts.push(row.rawText)
  }

  return buckets.map(({ baseUnit: _baseUnit, ...item }) => item)
}

/**
 * Canonical unit name when the token is known, otherwise the cleaned-up raw
 * token so it stays distinct from both other unknown units and unitless rows.
 */
function normalizeRow(raw: string | null): string | null {
  if (raw === null) return null
  const canonical = normalizeUnit(raw)
  if (canonical !== null) return canonical
  const trimmed = raw.trim().toLowerCase()
  return trimmed === '' ? null : trimmed
}

/** Converts within a compatibility group using each unit's base factor. */
function convertQuantity(
  quantity: number,
  from: string | null,
  to: string | null,
): number {
  if (from === null || to === null || from === to) return quantity
  const fromFactor = UNIT_BASE_FACTORS[from]
  const toFactor = UNIT_BASE_FACTORS[to]
  if (fromFactor === undefined || toFactor === undefined) return quantity
  return (quantity * fromFactor) / toFactor
}

export async function generateShoppingList(
  recipeIds: string[],
  opts: { name?: string; excludeStaples?: boolean } = {},
): Promise<string> {
  const recipes = await db.recipe.findMany({
    where: { id: { in: recipeIds } },
    include: { ingredients: { include: { ingredient: true } } },
  })

  const staples = opts.excludeStaples
    ? new Set(
        (await db.pantryStaple.findMany()).map((s) => s.ingredientId),
      )
    : new Set<string>()

  const rows: MergeRow[] = []
  for (const recipe of recipes) {
    for (const row of recipe.ingredients) {
      if (staples.has(row.ingredientId)) continue
      rows.push({
        ingredientId: row.ingredientId,
        name: row.ingredient.name,
        category: row.ingredient.category,
        quantity: row.quantity,
        unit: row.unit,
        recipeId: recipe.id,
        rawText: row.rawText,
      })
    }
  }

  const merged = mergeIngredients(rows)

  const list = await db.shoppingList.create({
    data: {
      name: opts.name ?? `Shopping list ${new Date().toLocaleDateString()}`,
      items: {
        create: merged.map((item, index) => ({
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unit: item.unit,
          note: item.rawTexts.join('; '),
          sortOrder: index,
          sources: {
            create: item.sourceRecipeIds.map((recipeId) => ({ recipeId })),
          },
        })),
      },
    },
  })
  return list.id
}

export async function getShoppingList(id: string) {
  return db.shoppingList.findUnique({
    where: { id },
    include: {
      items: {
        include: { ingredient: true, sources: { include: { recipe: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
}

export async function listShoppingLists() {
  return db.shoppingList.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function toggleItemChecked(
  itemId: string,
  checked: boolean,
): Promise<void> {
  await db.shoppingListItem.update({ where: { id: itemId }, data: { checked } })
}

export async function addManualItem(
  listId: string,
  input: { name: string; quantity?: number | null; unit?: string | null },
) {
  const count = await db.shoppingListItem.count({ where: { listId } })

  // A shopping list is not only food: "batteries" and "foil" belong on it, but
  // creating an Ingredient for them would leak into pantry matching and the
  // unknown-ingredient prompts forever. So the name is only linked when it
  // already resolves to a known ingredient or alias -- checked with a lookup
  // that does not write, unlike resolveIngredient, which creates before it can
  // report isNew. Anything else is kept verbatim as manualText.
  const [unknown] = await findUnknownNames([input.name])
  const ingredient =
    unknown === undefined ? await resolveIngredient(input.name) : null

  return db.shoppingListItem.create({
    data: {
      listId,
      ingredientId: ingredient?.id ?? null,
      manualText: ingredient === null ? input.name.trim() : null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      sortOrder: count,
    },
    include: { ingredient: true },
  })
}

/**
 * Removes a list and, by cascade, its items and their recipe sources. Returns
 * false when no such list exists, so the route can answer 404.
 */
export async function deleteShoppingList(id: string): Promise<boolean> {
  const { count } = await db.shoppingList.deleteMany({ where: { id } })
  return count > 0
}

/**
 * Drops the items already in the basket, returning how many went so the caller
 * can say. Scoped to the one list: the same ingredient is often checked off on
 * another list that has not been shopped yet.
 */
export async function clearCheckedItems(listId: string): Promise<number> {
  const { count } = await db.shoppingListItem.deleteMany({
    where: { listId, checked: true },
  })
  return count
}
