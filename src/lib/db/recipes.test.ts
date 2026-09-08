import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'
import type { ParsedIngredient } from '@/lib/parsing/types'

let cleanup: () => void

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

afterAll(() => cleanup())

function ingredient(
  ingredientName: string,
  quantity: number | null,
  unit: string | null,
  rawText: string,
): ParsedIngredient {
  return {
    quantity, unit, ingredient: ingredientName, note: null,
    rawText, confidence: 'high',
  }
}

describe('createRecipe', () => {
  it('stores a recipe with its ingredients', async () => {
    const { createRecipe, getRecipe } = await import('./recipes')
    const id = await createRecipe({
      title: 'Garlic Pasta',
      instructions: 'Boil. Toss.',
      ingredients: [
        ingredient('spaghetti', 1, 'pound', '1 lb spaghetti'),
        ingredient('garlic', 4, 'clove', '4 cloves garlic'),
      ],
    })
    const recipe = await getRecipe(id)
    expect(recipe?.title).toBe('Garlic Pasta')
    expect(recipe?.ingredients).toHaveLength(2)
  })

  it('preserves rawText verbatim', async () => {
    const { createRecipe, getRecipe } = await import('./recipes')
    const id = await createRecipe({
      title: 'Raw Text Check',
      instructions: '',
      ingredients: [ingredient('olive oil', null, null, 'a good glug of olive oil')],
    })
    const recipe = await getRecipe(id)
    expect(recipe?.ingredients[0].rawText).toBe('a good glug of olive oil')
  })

  it('preserves ingredient ordering', async () => {
    const { createRecipe, getRecipe } = await import('./recipes')
    const id = await createRecipe({
      title: 'Ordering',
      instructions: '',
      ingredients: [
        ingredient('flour', 2, 'cup', '2 cups flour'),
        ingredient('salt', 1, 'teaspoon', '1 tsp salt'),
        ingredient('yeast', 1, 'package', '1 package yeast'),
      ],
    })
    const recipe = await getRecipe(id)
    expect(recipe?.ingredients.map((i) => i.ingredient.name)).toEqual([
      'flour', 'salt', 'yeast',
    ])
  })

  it('reuses a canonical ingredient across recipes', async () => {
    const { createRecipe, getRecipe } = await import('./recipes')
    const a = await createRecipe({
      title: 'A', instructions: '',
      ingredients: [ingredient('butter', 1, 'stick', '1 stick butter')],
    })
    const b = await createRecipe({
      title: 'B', instructions: '',
      ingredients: [ingredient('Butter', 2, 'stick', '2 sticks Butter')],
    })
    const ra = await getRecipe(a)
    const rb = await getRecipe(b)
    expect(rb?.ingredients[0].ingredientId).toBe(ra?.ingredients[0].ingredientId)
  })

  it('attaches tags', async () => {
    const { createRecipe, getRecipe } = await import('./recipes')
    const id = await createRecipe({
      title: 'Tagged', instructions: '', ingredients: [],
      tags: ['italian', 'weeknight'],
    })
    const recipe = await getRecipe(id)
    expect(recipe?.tags.map((t) => t.tag.name).sort()).toEqual([
      'italian', 'weeknight',
    ])
  })
})

describe('updateRecipe', () => {
  it('replaces the ingredient list', async () => {
    const { createRecipe, updateRecipe, getRecipe } = await import('./recipes')
    const id = await createRecipe({
      title: 'Before', instructions: '',
      ingredients: [ingredient('sugar', 1, 'cup', '1 cup sugar')],
    })
    await updateRecipe(id, {
      title: 'After', instructions: '',
      ingredients: [ingredient('honey', 2, 'tablespoon', '2 tbsp honey')],
    })
    const recipe = await getRecipe(id)
    expect(recipe?.title).toBe('After')
    expect(recipe?.ingredients).toHaveLength(1)
    expect(recipe?.ingredients[0].ingredient.name).toBe('honey')
  })
})

describe('deleteRecipe', () => {
  it('removes the recipe and its ingredient rows', async () => {
    const { createRecipe, deleteRecipe, getRecipe } = await import('./recipes')
    const id = await createRecipe({
      title: 'Doomed', instructions: '',
      ingredients: [ingredient('kale', 1, 'bunch', '1 bunch kale')],
    })
    await deleteRecipe(id)
    expect(await getRecipe(id)).toBeNull()
  })
})
