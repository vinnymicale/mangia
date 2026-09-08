import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'
import type { ParsedIngredient } from '@/lib/parsing/types'

let cleanup: () => void

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

  const { ensureFtsSchema } = await import('./search')
  await ensureFtsSchema()

  const { createRecipe } = await import('./recipes')
  await createRecipe({
    title: 'Tomato Basil Pasta',
    description: 'A summer weeknight dinner',
    instructions: 'Boil pasta. Add sauce.',
    ingredients: [ing('pasta'), ing('tomato'), ing('basil'), ing('garlic')],
  })
  await createRecipe({
    title: 'Garlic Bread',
    description: 'Crusty and buttery',
    instructions: 'Toast it.',
    ingredients: [ing('bread'), ing('garlic'), ing('butter')],
  })
  await createRecipe({
    title: 'Chicken Curry',
    description: 'Warming and spiced',
    instructions: 'Simmer.',
    ingredients: [ing('chicken'), ing('onion'), ing('curry powder')],
  })
})

afterAll(() => cleanup())

describe('searchRecipes', () => {
  it('matches on title', async () => {
    const { searchRecipes } = await import('./search')
    const { getRecipe } = await import('./recipes')
    const ids = await searchRecipes('curry')
    expect(ids).toHaveLength(1)
    expect((await getRecipe(ids[0]))?.title).toBe('Chicken Curry')
  })

  it('matches on description text', async () => {
    const { searchRecipes } = await import('./search')
    const ids = await searchRecipes('buttery')
    expect(ids).toHaveLength(1)
  })

  it('matches a prefix', async () => {
    const { searchRecipes } = await import('./search')
    const ids = await searchRecipes('gar')
    expect(ids.length).toBeGreaterThan(0)
  })

  it('returns an empty array for no match', async () => {
    const { searchRecipes } = await import('./search')
    expect(await searchRecipes('zzzzzz')).toEqual([])
  })

  it('returns an empty array for a blank query', async () => {
    const { searchRecipes } = await import('./search')
    expect(await searchRecipes('   ')).toEqual([])
  })

  it('does not throw on fts special characters', async () => {
    const { searchRecipes } = await import('./search')
    await expect(searchRecipes('garlic "AND (')).resolves.toBeInstanceOf(Array)
  })
})

describe('matchByIngredients', () => {
  it('ranks a full match above a partial one', async () => {
    const { matchByIngredients } = await import('./search')
    const results = await matchByIngredients(['bread', 'garlic', 'butter'])
    expect(results[0].title).toBe('Garlic Bread')
    expect(results[0].coverage).toBe(1)
  })

  it('reports what is missing', async () => {
    const { matchByIngredients } = await import('./search')
    const results = await matchByIngredients(['pasta', 'tomato', 'basil'])
    const pasta = results.find((r) => r.title === 'Tomato Basil Pasta')!
    expect(pasta.haveCount).toBe(3)
    expect(pasta.totalCount).toBe(4)
    expect(pasta.missing).toEqual(['garlic'])
  })

  it('keeps near-misses in the results', async () => {
    const { matchByIngredients } = await import('./search')
    const results = await matchByIngredients(['garlic'])
    expect(results.map((r) => r.title)).toContain('Tomato Basil Pasta')
  })

  it('honours minCoverage', async () => {
    const { matchByIngredients } = await import('./search')
    const results = await matchByIngredients(['garlic'], { minCoverage: 0.5 })
    expect(results).toEqual([])
  })

  it('is case-insensitive', async () => {
    const { matchByIngredients } = await import('./search')
    const results = await matchByIngredients(['BREAD', 'Garlic', 'BUTTER'])
    expect(results[0].coverage).toBe(1)
  })

  it('returns an empty array when given no ingredients', async () => {
    const { matchByIngredients } = await import('./search')
    expect(await matchByIngredients([])).toEqual([])
  })
})
