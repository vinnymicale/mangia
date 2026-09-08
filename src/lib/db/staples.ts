import type { PantryStaple } from '@/generated/prisma/client'
import { db } from './client'
import { normalizeIngredientName, resolveIngredient } from './ingredients'

export async function listStaples(): Promise<PantryStaple[]> {
  return db.pantryStaple.findMany({ orderBy: { name: 'asc' } })
}

export async function addStaple(name: string): Promise<PantryStaple> {
  const normalized = normalizeIngredientName(name)
  const existing = await db.pantryStaple.findUnique({ where: { name: normalized } })
  if (existing !== null) return existing
  // A staple points at the canonical ingredient, because
  // `generateShoppingList` excludes staples by ingredient id.
  const ingredient = await resolveIngredient(normalized)
  return db.pantryStaple.create({
    data: { name: normalized, ingredientId: ingredient.id },
  })
}

export async function removeStaple(id: string): Promise<void> {
  await db.pantryStaple.delete({ where: { id } })
}
