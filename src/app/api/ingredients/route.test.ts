import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'

vi.mock('@/lib/llm', () => ({ buildProvider: vi.fn() }))

let cleanup: () => void

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

afterAll(() => cleanup())

afterEach(() => vi.unstubAllGlobals())

function request(method: string, body?: unknown, query = ''): Request {
  return new Request(`http://x/api/ingredients${query}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

/** A recipe using `name`, returning the ingredient's ID. */
async function newIngredient(name: string): Promise<string> {
  const { createRecipe, getRecipe } = await import('@/lib/db/recipes')
  const recipeId = await createRecipe({
    title: name,
    instructions: 'Cook.',
    ingredients: [{ quantity: 1, unit: null, ingredient: name, note: null, rawText: name, confidence: 'high' }],
  })
  return (await getRecipe(recipeId))!.ingredients[0].ingredientId
}

describe('GET /api/ingredients', () => {
  it('lists ingredients in use, filtered to the empty ones', async () => {
    const { GET } = await import('./route')
    const { upsertIngredientNutrition } = await import('@/lib/db/nutrition')
    const { EMPTY_NUTRIENTS } = await import('@/lib/nutrition/types')
    const known = await newIngredient('artichoke')
    await newIngredient('burdock')
    await upsertIngredientNutrition(known, {
      ...EMPTY_NUTRIENTS, kcal: 47, source: 'manual', fdcId: null, fdcDescription: null,
    })

    const all = (await (await GET(request('GET'))).json()).ingredients
    expect(all.map((i: { name: string }) => i.name)).toEqual(expect.arrayContaining(['artichoke', 'burdock']))
    expect(all.find((i: { name: string }) => i.name === 'artichoke').recipeCount).toBe(1)

    const empty = (await (await GET(request('GET', undefined, '?filter=empty'))).json()).ingredients
    expect(empty.map((i: { name: string }) => i.name)).toContain('burdock')
    expect(empty.map((i: { name: string }) => i.name)).not.toContain('artichoke')
  })

  it('rejects an unknown filter', async () => {
    const { GET } = await import('./route')
    expect((await GET(request('GET', undefined, '?filter=odd'))).status).toBe(400)
  })
})

describe('PUT /api/ingredients/[id]/nutrition', () => {
  it('scales values given per unit to 100 g and keeps the weight', async () => {
    const { PUT } = await import('./[id]/nutrition/route')
    const id = await newIngredient('celeriac')

    const response = await PUT(
      request('PUT', { nutrients: { kcal: 44 }, per: { unit: null, grams: 110 } }),
      params(id),
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.nutrition).toMatchObject({ kcal: 40, source: 'manual' })
    expect(body.weights).toEqual([{ unit: null, grams: 110, source: 'manual' }])
  })

  it('keeps the USDA match when left blank', async () => {
    const { PUT } = await import('./[id]/nutrition/route')
    const { upsertIngredientNutrition } = await import('@/lib/db/nutrition')
    const { EMPTY_NUTRIENTS } = await import('@/lib/nutrition/types')
    const id = await newIngredient('daikon')
    await upsertIngredientNutrition(id, {
      ...EMPTY_NUTRIENTS, kcal: 18, source: 'usda', fdcId: 7, fdcDescription: 'Radishes, oriental, raw',
    })

    const body = await (await PUT(request('PUT', { source: 'none' }), params(id))).json()
    expect(body.nutrition).toMatchObject({ source: 'none', kcal: null, fdcId: 7 })
  })

  it('rejects implausible or empty values, and unknown ingredients', async () => {
    const { PUT } = await import('./[id]/nutrition/route')
    const id = await newIngredient('endive')
    expect((await PUT(request('PUT', { nutrients: { kcal: 5000 } }), params(id))).status).toBe(400)
    expect((await PUT(request('PUT', { nutrients: {} }), params(id))).status).toBe(400)
    expect((await PUT(request('PUT', { nutrients: { kcal: 1 } }), params('nope'))).status).toBe(404)
  })
})

describe('POST /api/ingredients/[id]/nutrition/usda', () => {
  it('re-matches and drops the old food\'s portions', async () => {
    const { POST } = await import('./[id]/nutrition/usda/route')
    const { upsertUnitWeight } = await import('@/lib/db/nutrition')
    const id = await newIngredient('fennel')
    await upsertUnitWeight(id, 'cup', 87, 'usda')
    await upsertUnitWeight(id, null, 234, 'manual')
    vi.stubGlobal('fetch', vi.fn(async (_url: URL | string) => Response.json([{
      fdcId: 42, description: 'Fennel, bulb, raw', foodNutrients: [{ nutrient: { id: 1008 }, amount: 31 }], foodPortions: [],
    }])))

    const body = await (await POST(request('POST', { fdcId: 42 }), params(id))).json()
    expect(body.nutrition).toMatchObject({ kcal: 31, source: 'usda', fdcId: 42 })
    expect(body.weights).toEqual([{ unit: null, grams: 234, source: 'manual' }])
  })

  it('answers 502 when USDA is unavailable', async () => {
    const { POST } = await import('./[id]/nutrition/usda/route')
    const id = await newIngredient('garlic')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    expect((await POST(request('POST', { fdcId: 1 }), params(id))).status).toBe(502)
  })
})

describe('/api/ingredients/[id]/weights', () => {
  it('sets, blanks and deletes a weight', async () => {
    const { PUT, DELETE } = await import('./[id]/weights/route')
    const id = await newIngredient('ginger')

    let body = await (await PUT(request('PUT', { unit: 'Thumb', grams: 15 }), params(id))).json()
    expect(body.weights).toEqual([{ unit: 'thumb', grams: 15, source: 'manual' }])

    body = await (await PUT(request('PUT', { unit: 'thumb', grams: null }), params(id))).json()
    expect(body.weights).toEqual([{ unit: 'thumb', grams: null, source: 'none' }])

    body = await (await DELETE(request('DELETE', undefined, '?unit=thumb'), params(id))).json()
    expect(body.weights).toEqual([])
    expect((await DELETE(request('DELETE', undefined, '?unit=thumb'), params(id))).status).toBe(404)
  })

  it('rejects a weight unit and an implausible weight', async () => {
    const { PUT } = await import('./[id]/weights/route')
    const id = await newIngredient('horseradish')
    expect((await PUT(request('PUT', { unit: 'g', grams: 1 }), params(id))).status).toBe(400)
    expect((await PUT(request('PUT', { unit: null, grams: 0 }), params(id))).status).toBe(400)
  })
})
