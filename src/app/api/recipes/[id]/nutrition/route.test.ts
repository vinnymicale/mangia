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

function request(method: string, body?: unknown): Request {
  return new Request('http://x/api/recipes/r/nutrition', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

async function newRecipe(): Promise<string> {
  const { createRecipe } = await import('@/lib/db/recipes')
  return createRecipe({
    title: 'Soup',
    instructions: 'Simmer.',
    servings: 2,
    ingredients: [{
      quantity: 200, unit: 'g', ingredient: 'leek', note: null, rawText: '200 g leek', confidence: 'high',
    }],
  })
}

/** USDA answering "leek" with one food at 61 kcal per 100 g. */
function stubUsda() {
  vi.stubGlobal('fetch', vi.fn(async (url: URL | string) => {
    if (String(url).includes('/foods/search')) {
      return Response.json({ foods: [{ fdcId: 10, description: 'Leeks, raw', dataType: 'SR Legacy' }] })
    }
    return Response.json([{
      fdcId: 10, description: 'Leeks, raw', foodNutrients: [{ nutrient: { id: 1008 }, amount: 61 }], foodPortions: [],
    }])
  }))
}

describe('/api/recipes/[id]/nutrition', () => {
  it('reads the stored estimate as pending without touching the network', async () => {
    const { GET } = await import('./route')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const id = await newRecipe()

    const body = await (await GET(request('GET'), params(id))).json()
    expect(body.pending).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resolves on POST with an empty body', async () => {
    const { POST } = await import('./route')
    stubUsda()
    const id = await newRecipe()

    const response = await POST(request('POST'), params(id))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.usdaUnavailable).toBe(false)
    expect(body.totals.kcal).toBeCloseTo(61)
  })

  it('rejects a malformed retry flag', async () => {
    const { POST } = await import('./route')
    const id = await newRecipe()
    expect((await POST(request('POST', { retryUnmatched: 'yes' }), params(id))).status).toBe(400)
  })

  it('answers 404 for an unknown recipe', async () => {
    const { GET, POST } = await import('./route')
    expect((await GET(request('GET'), params('nope'))).status).toBe(404)
    expect((await POST(request('POST', {}), params('nope'))).status).toBe(404)
  })
})

describe('/api/recipes/[id]/nutrition/override', () => {
  it('sets and clears an override', async () => {
    const { PUT, DELETE } = await import('./override/route')
    const id = await newRecipe()

    const set = await (await PUT(request('PUT', { kcal: 640, protein: 38, note: 'From the box' }), params(id))).json()
    expect(set.source).toBe('override')
    expect(set.totals.kcal).toBe(640)
    expect(set.overrideNote).toBe('From the box')

    const cleared = await (await DELETE(request('DELETE'), params(id))).json()
    expect(cleared.source).not.toBe('override')
  })

  it('rejects an override with no values', async () => {
    const { PUT } = await import('./override/route')
    const id = await newRecipe()
    expect((await PUT(request('PUT', { note: 'nothing' }), params(id))).status).toBe(400)
  })

  it('answers 404 for an unknown recipe', async () => {
    const { PUT } = await import('./override/route')
    expect((await PUT(request('PUT', { kcal: 1 }), params('nope'))).status).toBe(404)
  })
})

describe('PUT /api/recipes/[id] with nutritionOverride', () => {
  it('keeps the override when absent and clears it on null', async () => {
    const { PUT } = await import('../route')
    const { getOverride, setOverride } = await import('@/lib/db/nutrition')
    const id = await newRecipe()
    await setOverride(id, { ...(await import('@/lib/nutrition/types')).EMPTY_NUTRIENTS, kcal: 500, note: null })
    const recipe = { title: 'Soup', instructions: 'Simmer.', ingredients: [] }

    await PUT(request('PUT', recipe), params(id))
    expect((await getOverride(id))?.kcal).toBe(500)

    await PUT(request('PUT', { ...recipe, nutritionOverride: { kcal: 700 } }), params(id))
    expect((await getOverride(id))?.kcal).toBe(700)

    await PUT(request('PUT', { ...recipe, nutritionOverride: null }), params(id))
    expect(await getOverride(id)).toBeNull()
  })
})
