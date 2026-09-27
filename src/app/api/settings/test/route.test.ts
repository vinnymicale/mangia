import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'

vi.mock('@/lib/llm', () => ({ buildProvider: vi.fn() }))
vi.mock('@/lib/backup/drive', () => ({ checkAccess: vi.fn() }))

import { buildProvider } from '@/lib/llm'

let cleanup: () => void

beforeAll(() => {
  const database = createTestDatabase()
  process.env.DATABASE_URL = database.url
  cleanup = database.cleanup
})

afterAll(() => cleanup())

afterEach(() => vi.unstubAllGlobals())

function post(body: unknown): Request {
  return new Request('http://x/api/settings/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/settings/test', () => {
  it('rejects an unknown target', async () => {
    expect((await (await import('./route')).POST(post({ target: 'smtp' }))).status).toBe(400)
  })

  it('reports a working provider', async () => {
    vi.mocked(buildProvider).mockReturnValue({
      name: 'gemini',
      parseIngredientLines: vi.fn().mockResolvedValue([]),
    } as never)

    const response = await (await import('./route')).POST(post({ target: 'llm' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
  })

  // A test that fails is an answer, not a server error: the page needs the
  // upstream message, and a 500 would lose it behind a generic failure.
  it('reports a failing provider as a 200 carrying the reason', async () => {
    vi.mocked(buildProvider).mockReturnValue({
      name: 'gemini',
      parseIngredientLines: vi.fn().mockRejectedValue(new Error('API key not valid.')),
    } as never)

    const response = await (await import('./route')).POST(post({ target: 'llm' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: false, detail: 'API key not valid.' })
  })

  it('says so plainly when no drive key is configured', async () => {
    const response = await (await import('./route')).POST(post({ target: 'drive' }))
    expect(response.status).toBe(200)
    expect((await response.json()).ok).toBe(false)
  })

  it('searches FoodData Central for the usda target', async () => {
    const fetchMock = vi.fn(async (_url: URL | string) => Response.json({
      foods: [{ fdcId: 1, description: 'Onions, raw', dataType: 'SR Legacy' }],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await (await import('./route')).POST(post({ target: 'usda' }))
    expect(await response.json()).toEqual({
      ok: true,
      detail: 'FoodData Central answered using DEMO_KEY, limited to 30 requests an hour.',
    })
    expect(String(fetchMock.mock.calls[0][0])).toContain('api_key=DEMO_KEY')
  })

  it('reports an unreachable FoodData Central as a failed test', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    const body = await (await (await import('./route')).POST(post({ target: 'usda' }))).json()
    expect(body.ok).toBe(false)
    expect(body.detail).toMatch(/unreachable/)
  })
})
