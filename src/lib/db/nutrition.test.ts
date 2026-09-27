import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'
import { EMPTY_NUTRIENTS } from '@/lib/nutrition/types'

let cleanup: () => void

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

afterAll(() => cleanup())

async function newIngredient(name: string): Promise<string> {
  const { db } = await import('./client')
  const row = await db.ingredient.create({ data: { name } })
  return row.id
}

describe('ingredient nutrition', () => {
  it('upserts one row per ingredient', async () => {
    const { upsertIngredientNutrition, getNutritionData } = await import('./nutrition')
    const id = await newIngredient('flour')
    await upsertIngredientNutrition(id, {
      ...EMPTY_NUTRIENTS, kcal: 364, source: 'usda', fdcId: 169761, fdcDescription: 'Wheat flour',
    })
    await upsertIngredientNutrition(id, {
      ...EMPTY_NUTRIENTS, kcal: 350, source: 'manual', fdcId: null, fdcDescription: null,
    })

    const { nutrition } = await getNutritionData([id])
    expect(nutrition.get(id)).toEqual({
      ...EMPTY_NUTRIENTS, kcal: 350, source: 'manual', fdcId: null, fdcDescription: null,
    })
  })

  it('returns nothing for an ingredient never attempted', async () => {
    const { getNutritionData } = await import('./nutrition')
    const id = await newIngredient('saffron')
    const { nutrition, weights } = await getNutritionData([id])
    expect(nutrition.has(id)).toBe(false)
    expect(weights.has(id)).toBe(false)
  })
})

describe('unit weights', () => {
  it('stores a bare count and reads it back as null', async () => {
    const { upsertUnitWeight, getNutritionData } = await import('./nutrition')
    const { db } = await import('./client')
    const id = await newIngredient('egg')
    await upsertUnitWeight(id, null, 50, 'usda')

    const raw = await db.ingredientUnitWeight.findFirstOrThrow({ where: { ingredientId: id } })
    expect(raw.unit).toBe('')
    const { weights } = await getNutritionData([id])
    expect(weights.get(id)).toEqual([{ unit: null, grams: 50, source: 'usda' }])
  })

  it('keeps one row per unit, bare count included', async () => {
    const { upsertUnitWeight, getNutritionData } = await import('./nutrition')
    const id = await newIngredient('onion')
    await upsertUnitWeight(id, null, 110, 'ai')
    await upsertUnitWeight(id, null, 150, 'manual')
    await upsertUnitWeight(id, 'cup', 160, 'usda')

    const { weights } = await getNutritionData([id])
    expect(weights.get(id)).toHaveLength(2)
    expect(weights.get(id)).toContainEqual({ unit: null, grams: 150, source: 'manual' })
  })

  it('deletes a weight so it can be retried', async () => {
    const { upsertUnitWeight, deleteUnitWeight, getNutritionData } = await import('./nutrition')
    const id = await newIngredient('garlic')
    await upsertUnitWeight(id, null, null, 'unmatched')

    expect(await deleteUnitWeight(id, null)).toBe(true)
    expect(await deleteUnitWeight(id, null)).toBe(false)
    expect((await getNutritionData([id])).weights.has(id)).toBe(false)
  })
})

describe('recipe override', () => {
  it('sets, replaces and clears', async () => {
    const { setOverride, getOverride, clearOverride } = await import('./nutrition')
    const { createRecipe } = await import('./recipes')
    const recipeId = await createRecipe({ title: 'Toast', instructions: 'Cook.', ingredients: [] })

    expect(await getOverride(recipeId)).toBeNull()
    await setOverride(recipeId, { ...EMPTY_NUTRIENTS, kcal: 200, note: null })
    await setOverride(recipeId, { ...EMPTY_NUTRIENTS, kcal: 250, note: 'From the box' })
    expect(await getOverride(recipeId)).toEqual({ ...EMPTY_NUTRIENTS, kcal: 250, note: 'From the box' })

    expect(await clearOverride(recipeId)).toBe(true)
    expect(await getOverride(recipeId)).toBeNull()
  })
})

describe('cascade', () => {
  it('removes nutrition and weights with the ingredient, and the override with the recipe', async () => {
    const { db } = await import('./client')
    const { upsertIngredientNutrition, upsertUnitWeight, setOverride } = await import('./nutrition')
    const { createRecipe, deleteRecipe } = await import('./recipes')
    const id = await newIngredient('butter')
    await upsertIngredientNutrition(id, {
      ...EMPTY_NUTRIENTS, fat: 81, source: 'usda', fdcId: 1, fdcDescription: 'Butter',
    })
    await upsertUnitWeight(id, 'tbsp', 14, 'usda')
    await db.ingredient.delete({ where: { id } })
    expect(await db.ingredientNutrition.count({ where: { ingredientId: id } })).toBe(0)
    expect(await db.ingredientUnitWeight.count({ where: { ingredientId: id } })).toBe(0)

    const recipeId = await createRecipe({ title: 'Soup', instructions: 'Cook.', ingredients: [] })
    await setOverride(recipeId, { ...EMPTY_NUTRIENTS, kcal: 100, note: null })
    await deleteRecipe(recipeId)
    expect(await db.recipeNutritionOverride.count({ where: { recipeId } })).toBe(0)
  })
})
