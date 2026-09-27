import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'

vi.mock('@/lib/llm', () => ({ buildProvider: vi.fn() }))

import { buildProvider } from '@/lib/llm'

let cleanup: () => void

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

afterAll(() => cleanup())

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function suggest(body: unknown): Request {
  return new Request('http://x/api/nutrition/suggest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/nutrition/usda-search', () => {
  it('returns candidates', async () => {
    const { GET } = await import('./usda-search/route')
    vi.stubGlobal('fetch', vi.fn(async (_url: URL | string) => Response.json({
      foods: [{ fdcId: 1, description: 'Onions, raw', dataType: 'SR Legacy' }],
    })))
    const body = await (await GET(new Request('http://x/api/nutrition/usda-search?q=onion'))).json()
    expect(body.results).toEqual([{ fdcId: 1, description: 'Onions, raw', dataType: 'SR Legacy' }])
  })

  it('rejects an empty query and reports an unavailable USDA', async () => {
    const { GET } = await import('./usda-search/route')
    expect((await GET(new Request('http://x/api/nutrition/usda-search?q=%20'))).status).toBe(400)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    expect((await GET(new Request('http://x/api/nutrition/usda-search?q=onion'))).status).toBe(502)
  })
})

describe('POST /api/nutrition/suggest', () => {
  it('says so when no provider is configured', async () => {
    const { POST } = await import('./suggest/route')
    vi.stubEnv('LLM_API_KEY', '')
    expect((await POST(suggest({ name: 'onion' }))).status).toBe(409)
  })

  it('returns a plausible estimate without storing it', async () => {
    const { POST } = await import('./suggest/route')
    vi.stubEnv('LLM_API_KEY', 'k')
    const nutrients = { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: null, sugar: null, sodium: null }
    vi.mocked(buildProvider).mockReturnValue({ estimateNutrition: vi.fn().mockResolvedValue(nutrients) } as never)

    expect(await (await POST(suggest({ name: 'onion' }))).json()).toEqual({ nutrients })
  })

  it('answers 502 for a failing provider or an implausible answer', async () => {
    const { POST } = await import('./suggest/route')
    vi.stubEnv('LLM_API_KEY', 'k')
    vi.mocked(buildProvider).mockReturnValue({
      estimateNutrition: vi.fn().mockRejectedValue(new Error('quota')),
    } as never)
    expect((await POST(suggest({ name: 'onion' }))).status).toBe(502)

    vi.mocked(buildProvider).mockReturnValue({
      estimateNutrition: vi.fn().mockResolvedValue({
        kcal: 9000, protein: null, carbs: null, fat: null, fiber: null, sugar: null, sodium: null,
      }),
    } as never)
    expect((await POST(suggest({ name: 'onion' }))).status).toBe(502)
  })
})
