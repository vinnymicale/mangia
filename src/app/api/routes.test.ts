import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/llm', () => ({
  getProvider: vi.fn(),
}))

vi.mock('@/lib/import/webImporter', () => ({
  importFromUrl: vi.fn(),
}))

vi.mock('@/lib/import/videoImporter', () => ({
  importFromVideo: vi.fn(),
}))

import { getProvider } from '@/lib/llm'
import type { RecipeDraft } from '@/lib/llm/types'
import { importFromUrl } from '@/lib/import/webImporter'
import { importFromVideo } from '@/lib/import/videoImporter'
import { POST as parseRoute } from './parse-ingredients/route'
import { POST as cleanRoute } from './clean-ingredients/route'
import { POST as importRoute } from './import/route'

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
    vi.mocked(getProvider).mockResolvedValue({
      name: 'test', extractRecipe: vi.fn(), parseIngredientLines,
      extractRecipeFromImage: vi.fn(), extractRecipeFromVideo: vi.fn(),
      matchFoods: vi.fn(), estimateUnitWeights: vi.fn(), estimateNutrition: vi.fn(),
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
    vi.mocked(getProvider).mockResolvedValue({
      name: 'test',
      extractRecipe: vi.fn(),
      extractRecipeFromImage: vi.fn(),
      extractRecipeFromVideo: vi.fn(),
      parseIngredientLines: vi.fn().mockRejectedValue(new Error('quota exceeded')),
      matchFoods: vi.fn(),
      estimateUnitWeights: vi.fn(),
      estimateNutrition: vi.fn(),
    })
    const response = await cleanRoute(
      post('http://x/api/clean-ingredients', { lines: ['a glug of oil'] }),
    )
    expect(response.status).toBe(502)
    const body = await response.json()
    expect(body.error).toContain('quota exceeded')
  })
})

describe('POST /api/import', () => {
  const DRAFT: RecipeDraft = {
    title: 'Cacio e Pepe',
    description: null,
    instructions: '1. Boil.',
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    ingredients: [],
    tags: [],
  }

  beforeEach(() => {
    vi.mocked(importFromUrl).mockReset()
    vi.mocked(importFromVideo).mockReset()
  })

  // The client sends one URL box for both kinds, so this dispatch is the only
  // thing deciding whether a link is watched or scraped.
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.instagram.com/reel/CxYzAbCdEfG/',
    'https://www.tiktok.com/@chef/video/7212345678901234567',
  ])('routes %s to the video importer', async (url) => {
    vi.mocked(importFromVideo).mockResolvedValue({
      draft: DRAFT, method: 'video-caption', sourceUrl: url,
    })

    const response = await importRoute(post('http://x/api/import', { url }))

    expect(response.status).toBe(200)
    expect(importFromVideo).toHaveBeenCalledWith(url)
    expect(importFromUrl).not.toHaveBeenCalled()
  })

  it.each([
    'https://www.seriouseats.com/perfect-pan-pizza',
    // A channel page is on a video host but carries no recipe to watch.
    'https://www.youtube.com/@somechannel',
  ])('routes %s to the page importer', async (url) => {
    vi.mocked(importFromUrl).mockResolvedValue({
      draft: DRAFT, method: 'jsonld', sourceUrl: url,
    })

    const response = await importRoute(post('http://x/api/import', { url }))

    expect(response.status).toBe(200)
    expect(importFromUrl).toHaveBeenCalledWith(url)
    expect(importFromVideo).not.toHaveBeenCalled()
  })

  it('passes the method through so the form can say how it read the video', async () => {
    vi.mocked(importFromVideo).mockResolvedValue({
      draft: DRAFT, method: 'video-model', sourceUrl: 'https://youtu.be/abc',
    })

    const response = await importRoute(
      post('http://x/api/import', { url: 'https://youtu.be/abc' }),
    )

    expect(await response.json()).toEqual({
      draft: DRAFT, method: 'video-model', sourceUrl: 'https://youtu.be/abc',
    })
  })

  it('rejects a missing url field', async () => {
    const response = await importRoute(post('http://x/api/import', {}))
    expect(response.status).toBe(400)
    expect(importFromVideo).not.toHaveBeenCalled()
    expect(importFromUrl).not.toHaveBeenCalled()
  })

  // The ladder's final message names what actually failed, so it has to survive
  // the trip to the client rather than being flattened to a generic 502 body.
  it('surfaces the importer failure as a 502 carrying its message', async () => {
    vi.mocked(importFromVideo).mockRejectedValue(
      new Error('That video could not be read: the download timed out'),
    )

    const response = await importRoute(
      post('http://x/api/import', { url: 'https://vm.tiktok.com/ZMabcdef/' }),
    )

    expect(response.status).toBe(502)
    expect((await response.json()).error).toMatch(/timed out/)
  })
})
