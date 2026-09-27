import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'
import type { ParsedIngredient } from '@/lib/parsing/types'
import type { LlmProvider } from '@/lib/llm/types'

let cleanup: () => void

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

afterAll(() => cleanup())

afterEach(() => {
  vi.unstubAllGlobals()
})

const USDA = { apiKey: 'k', baseUrl: 'http://usda.test/fdc' }

interface FakeFood {
  fdcId: number
  description: string
  kcal: number
  portions?: { gramWeight: number; amount: number; modifier: string }[]
}

/** A USDA stand-in: search answers by query, the batch lookup by ID. */
function stubUsda(search: Record<string, FakeFood[]>, options: { unavailable?: boolean } = {}) {
  const foods = new Map(Object.values(search).flat().map((f) => [f.fdcId, f]))
  const fetchMock = vi.fn(async (url: URL | string, init: RequestInit) => {
    if (options.unavailable) return new Response('{}', { status: 503 })
    const body = JSON.parse(String(init.body))
    const path = new URL(String(url)).pathname
    if (path.endsWith('/foods/search')) {
      const results = (search[body.query] ?? []).map((f) => ({
        fdcId: f.fdcId, description: f.description, dataType: 'SR Legacy',
      }))
      return Response.json({ foods: results })
    }
    return Response.json((body.fdcIds as number[]).map((id) => {
      const f = foods.get(id)!
      return {
        fdcId: f.fdcId,
        description: f.description,
        foodNutrients: [{ nutrient: { id: 1008 }, amount: f.kcal }],
        foodPortions: (f.portions ?? []).map((p) => ({ ...p, measureUnit: { name: 'undetermined' } })),
      }
    }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function fakeProvider(patch: Partial<LlmProvider> = {}): LlmProvider {
  return {
    matchFoods: vi.fn(async () => { throw new Error('unused') }),
    estimateUnitWeights: vi.fn(async () => { throw new Error('unused') }),
    estimateNutrition: vi.fn(),
    ...patch,
  } as unknown as LlmProvider
}

function ingredient(name: string, quantity: number | null, unit: string | null): ParsedIngredient {
  return { quantity, unit, ingredient: name, note: null, rawText: name, confidence: 'high' }
}

async function newRecipe(servings: number | null, ingredients: ParsedIngredient[]): Promise<string> {
  const { createRecipe } = await import('@/lib/db/recipes')
  return createRecipe({ title: 'Test', instructions: 'Cook.', servings, ingredients })
}

describe('singularise and conservativeMatch', () => {
  it('singularises common plurals', async () => {
    const { singularise } = await import('./resolve')
    expect(singularise('Onions')).toBe('onion')
    expect(singularise('tomatoes')).toBe('tomato')
    expect(singularise('berries')).toBe('berry')
    expect(singularise('glass')).toBe('glass')
  })

  it('accepts only a top result whose lead term is the ingredient', async () => {
    const { conservativeMatch } = await import('./resolve')
    const onions = { fdcId: 1, description: 'Onions, raw', dataType: 'SR Legacy' }
    const rings = { fdcId: 2, description: 'Onion rings, breaded', dataType: 'SR Legacy' }
    expect(conservativeMatch('onion', [onions, rings])).toBe(1)
    expect(conservativeMatch('onion', [rings, onions])).toBeNull()
    expect(conservativeMatch('onion', [])).toBeNull()
  })
})

describe('resolveRecipeNutrition', () => {
  it('matches without a model and uses USDA portions', async () => {
    const { resolveRecipeNutrition } = await import('./resolve')
    stubUsda({
      leek: [{
        fdcId: 10, description: 'Leeks, raw', kcal: 61,
        portions: [{ gramWeight: 89, amount: 1, modifier: 'cup' }],
      }],
      quince: [{ fdcId: 11, description: 'Quince paste, sweetened', kcal: 300 }],
    })
    const id = await newRecipe(2, [
      ingredient('leek', 2, 'tbsp'),
      ingredient('quince', 100, 'g'),
    ])

    const result = await resolveRecipeNutrition(id, { retryUnmatched: false, usda: USDA, provider: null })

    expect(result!.usdaUnavailable).toBe(false)
    expect(result!.lines.map((l) => l.status)).toEqual(['counted', 'needsNutrition'])
    expect(result!.lines[0].fdcDescription).toBe('Leeks, raw')
    // Two tablespoons of an 89 g cup, per two servings.
    expect(result!.lines[0].grams).toBeCloseTo(11.1, 1)
  })

  it('uses one batched model call for matches, then estimates weights', async () => {
    const { resolveRecipeNutrition } = await import('./resolve')
    stubUsda({
      shallot: [{ fdcId: 20, description: 'Shallots, raw', kcal: 72 }],
      scallion: [{ fdcId: 21, description: 'Onions, spring or scallions', kcal: 32 }],
    })
    const provider = fakeProvider({
      matchFoods: vi.fn(async () => [20, 21]),
      estimateUnitWeights: vi.fn(async () => [40, 9000]),
    })
    const id = await newRecipe(1, [ingredient('shallot', 1, null), ingredient('scallion', 3, 'stalk')])

    const result = await resolveRecipeNutrition(id, { retryUnmatched: false, usda: USDA, provider })

    expect(provider.matchFoods).toHaveBeenCalledTimes(1)
    expect(provider.estimateUnitWeights).toHaveBeenCalledWith([
      { name: 'shallot', unit: null },
      { name: 'scallion', unit: 'stalk' },
    ])
    // 9 kg a stalk fails validation, so it is left for the cook.
    expect(result!.lines.map((l) => l.status)).toEqual(['counted', 'needsWeight'])
    expect(result!.totals.kcal).toBeCloseTo(28.8, 1)
  })

  it('falls back to the conservative match when the model fails', async () => {
    const { resolveRecipeNutrition } = await import('./resolve')
    stubUsda({ parsnip: [{ fdcId: 30, description: 'Parsnips, raw', kcal: 75 }] })
    const provider = fakeProvider({ matchFoods: vi.fn(async () => { throw new Error('boom') }) })
    const id = await newRecipe(1, [ingredient('parsnip', 50, 'g')])

    const result = await resolveRecipeNutrition(id, { retryUnmatched: false, usda: USDA, provider })

    expect(result!.lines[0].status).toBe('counted')
    expect(result!.totals.kcal).toBeCloseTo(37.5)
  })

  it('stops without writing when USDA is unavailable', async () => {
    const { resolveRecipeNutrition } = await import('./resolve')
    const { getNutritionData } = await import('@/lib/db/nutrition')
    stubUsda({}, { unavailable: true })
    const id = await newRecipe(1, [ingredient('fennel', 1, 'cup')])

    const result = await resolveRecipeNutrition(id, { retryUnmatched: false, usda: USDA, provider: null })

    expect(result!.usdaUnavailable).toBe(true)
    expect(result!.lines[0].status).toBe('pending')
    const { nutrition, weights } = await getNutritionData([result!.lines[0].ingredientId])
    expect(nutrition.size).toBe(0)
    expect(weights.size).toBe(0)
  })

  it('leaves unmatched rows alone unless asked to retry', async () => {
    const { resolveRecipeNutrition } = await import('./resolve')
    const fetchMock = stubUsda({})
    const id = await newRecipe(1, [ingredient('kohlrabi', 100, 'g')])
    await resolveRecipeNutrition(id, { retryUnmatched: false, usda: USDA, provider: null })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await resolveRecipeNutrition(id, { retryUnmatched: false, usda: USDA, provider: null })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    stubUsda({ kohlrabi: [{ fdcId: 40, description: 'Kohlrabi, raw', kcal: 27 }] })
    const result = await resolveRecipeNutrition(id, { retryUnmatched: true, usda: USDA, provider: null })
    expect(result!.lines[0].status).toBe('counted')
  })

  it('returns null for an unknown recipe', async () => {
    const { resolveRecipeNutrition } = await import('./resolve')
    expect(await resolveRecipeNutrition('nope', { retryUnmatched: false, usda: USDA, provider: null }))
      .toBeNull()
  })
})
