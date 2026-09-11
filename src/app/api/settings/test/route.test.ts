import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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
})
