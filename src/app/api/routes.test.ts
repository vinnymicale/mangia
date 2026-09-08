import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/llm', () => ({
  getProvider: vi.fn(),
}))

import { getProvider } from '@/lib/llm'
import { POST as parseRoute } from './parse-ingredients/route'
import { POST as cleanRoute } from './clean-ingredients/route'

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/parse-ingredients', () => {
  it('parses a blob without calling the LLM', async () => {
    const response = await parseRoute(
      post('http://x/api/parse-ingredients', { text: '2 cups flour\n1 tsp salt' }),
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ingredients).toHaveLength(2)
    expect(body.ingredients[0].ingredient).toBe('flour')
    expect(getProvider).not.toHaveBeenCalled()
  })

  it('rejects a missing text field', async () => {
    const response = await parseRoute(post('http://x/api/parse-ingredients', {}))
    expect(response.status).toBe(400)
  })
})

describe('POST /api/clean-ingredients', () => {
  beforeEach(() => {
    vi.mocked(getProvider).mockReset()
  })

  it('sends only the requested lines to the provider', async () => {
    const parseIngredientLines = vi.fn().mockResolvedValue([
      {
        quantity: 1, unit: 'tablespoon', ingredient: 'olive oil', note: null,
        rawText: 'a good glug of olive oil', confidence: 'high',
      },
    ])
    vi.mocked(getProvider).mockReturnValue({
      name: 'test', extractRecipe: vi.fn(), parseIngredientLines,
    })

    const response = await cleanRoute(
      post('http://x/api/clean-ingredients', { lines: ['a good glug of olive oil'] }),
    )
    expect(response.status).toBe(200)
    expect(parseIngredientLines).toHaveBeenCalledWith(['a good glug of olive oil'])
    const body = await response.json()
    expect(body.ingredients[0].ingredient).toBe('olive oil')
  })

  it('rejects an empty line list', async () => {
    const response = await cleanRoute(post('http://x/api/clean-ingredients', { lines: [] }))
    expect(response.status).toBe(400)
  })

  it('returns 502 when the provider fails', async () => {
    vi.mocked(getProvider).mockReturnValue({
      name: 'test',
      extractRecipe: vi.fn(),
      parseIngredientLines: vi.fn().mockRejectedValue(new Error('quota exceeded')),
    })
    const response = await cleanRoute(
      post('http://x/api/clean-ingredients', { lines: ['a glug of oil'] }),
    )
    expect(response.status).toBe(502)
    const body = await response.json()
    expect(body.error).toContain('quota exceeded')
  })
})
