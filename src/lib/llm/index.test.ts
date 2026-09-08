import { describe, it, expect, beforeEach } from 'vitest'
import { RecipeDraftSchema } from './types'

beforeEach(() => {
  delete process.env.LLM_PROVIDER
  delete process.env.LLM_API_KEY
  delete process.env.LLM_BASE_URL
})

describe('RecipeDraftSchema', () => {
  it('accepts a well-formed draft', () => {
    const parsed = RecipeDraftSchema.parse({
      title: 'Soup',
      description: null,
      instructions: 'Simmer.',
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 30,
      ingredients: [
        { quantity: 1, unit: 'cup', ingredient: 'stock', note: null },
      ],
      tags: ['soup'],
    })
    expect(parsed.title).toBe('Soup')
  })

  it('defaults missing optional fields to null', () => {
    const parsed = RecipeDraftSchema.parse({
      title: 'Minimal',
      instructions: '',
      ingredients: [],
    })
    expect(parsed.servings).toBeNull()
    expect(parsed.tags).toEqual([])
  })

  it('rejects a draft with no title', () => {
    expect(() =>
      RecipeDraftSchema.parse({ instructions: '', ingredients: [] }),
    ).toThrow()
  })
})

describe('getProvider', () => {
  it('defaults to gemini', async () => {
    process.env.LLM_API_KEY = 'test-key'
    const { getProvider } = await import('./index')
    expect(getProvider().name).toBe('gemini')
  })

  it('returns the openai-compatible provider when configured', async () => {
    process.env.LLM_PROVIDER = 'openai-compatible'
    process.env.LLM_BASE_URL = 'http://localhost:11434/v1'
    process.env.LLM_API_KEY = 'unused'
    const { getProvider } = await import('./index')
    expect(getProvider().name).toBe('openai-compatible')
  })

  it('throws a clear error when no api key is configured', async () => {
    const { getProvider } = await import('./index')
    expect(() => getProvider()).toThrow(/LLM_API_KEY/)
  })
})
