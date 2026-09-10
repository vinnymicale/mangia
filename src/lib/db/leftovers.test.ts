import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'
import type { ParsedIngredient } from '@/lib/parsing/types'

let cleanup: () => void
let recipesUsing: typeof import('./leftovers').recipesUsing
let suggestLeftovers: typeof import('./leftovers').suggestLeftovers

function ing(name: string): ParsedIngredient {
  return {
    quantity: 1, unit: null, ingredient: name, note: null,
    rawText: `1 ${name}`, confidence: 'high',
  }
}

beforeAll(async () => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup

  const { createRecipe } = await import('./recipes')
  // Ricotta is the leftover under test: it appears in three recipes with
  // ingredient lists of different lengths, which is what the ranking is for.
  await createRecipe({
    title: 'Ricotta Toast',
    instructions: 'Toast. Spread.',
    ingredients: [ing('bread'), ing('ricotta')],
  })
  await createRecipe({
    title: 'Lasagne',
    instructions: 'Layer. Bake.',
    ingredients: [
      ing('pasta'), ing('ricotta'), ing('tomato'),
      ing('beef'), ing('mozzarella'), ing('onion'),
    ],
  })
  await createRecipe({
    title: 'Ricotta Pancakes',
    instructions: 'Whisk. Fry.',
    ingredients: [ing('flour'), ing('ricotta'), ing('egg')],
  })
  await createRecipe({
    title: 'Green Salad',
    instructions: 'Toss.',
    ingredients: [ing('lettuce'), ing('lemon')],
  })

  const mod = await import('./leftovers')
  recipesUsing = mod.recipesUsing
  suggestLeftovers = mod.suggestLeftovers
})

afterAll(() => cleanup())

describe('recipesUsing', () => {
  it('finds every recipe that calls for the ingredient', async () => {
    const found = await recipesUsing('ricotta')
    expect(found.map((r) => r.title).sort()).toEqual([
      'Lasagne', 'Ricotta Pancakes', 'Ricotta Toast',
    ])
  })

  it('puts the shortest ingredient list first', async () => {
    // A leftover is a thing to use up tonight, so the recipe needing the
    // least else around it is the most useful answer, not the grandest dish.
    const found = await recipesUsing('ricotta')
    expect(found.map((r) => r.title)).toEqual([
      'Ricotta Toast', 'Ricotta Pancakes', 'Lasagne',
    ])
  })

  it('reports what else each recipe needs', async () => {
    const found = await recipesUsing('ricotta')
    const toast = found.find((r) => r.title === 'Ricotta Toast')!
    expect(toast.otherIngredients).toEqual(['bread'])
    expect(toast.totalCount).toBe(2)
  })

  it('resolves the name the same way a recipe save does', async () => {
    // Casing and stray whitespace are what a user actually types.
    const found = await recipesUsing('  Ricotta  ')
    expect(found).toHaveLength(3)
  })

  it('returns nothing for an ingredient no recipe uses', async () => {
    expect(await recipesUsing('saffron')).toEqual([])
  })

  it('returns nothing for a blank name', async () => {
    expect(await recipesUsing('   ')).toEqual([])
  })
})

describe('suggestLeftovers', () => {
  it('offers ingredients that appear in more than one recipe', async () => {
    const suggestions = await suggestLeftovers(10)
    const names = suggestions.map((s) => s.name)
    expect(names).toContain('ricotta')
    // A one-off ingredient is a dead end: looking it up can only ever return
    // the single recipe it came from, which the user already found.
    expect(names).not.toContain('lettuce')
  })

  it('ranks by how many recipes could use it up', async () => {
    const suggestions = await suggestLeftovers(10)
    expect(suggestions[0].name).toBe('ricotta')
    expect(suggestions[0].recipeCount).toBe(3)
  })

  it('honours the limit', async () => {
    expect(await suggestLeftovers(1)).toHaveLength(1)
  })
})
