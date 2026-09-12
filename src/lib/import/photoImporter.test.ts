import { describe, it, expect, vi } from 'vitest'
import { importFromPhoto } from './photoImporter'
import type { LlmProvider, RecipeDraft } from '@/lib/llm/types'

const DRAFT: RecipeDraft = {
  title: 'Vision Cake',
  description: null,
  instructions: '1. Bake it.',
  servings: null,
  prepMinutes: null,
  cookMinutes: null,
  ingredients: [{ quantity: 1, unit: 'cup', ingredient: 'flour', note: null }],
  tags: [],
}

const CARD = `Aunt Ida's Cake
Ingredients
1 cup flour

Method
Bake it.`

function provider(overrides: Partial<LlmProvider> = {}): LlmProvider {
  return {
    name: 'fake',
    extractRecipe: vi.fn(),
    parseIngredientLines: vi.fn(),
    extractRecipeFromImage: vi.fn(async () => DRAFT),
    ...overrides,
  } as LlmProvider
}

const image = Buffer.from('photo-bytes')

describe('importFromPhoto', () => {
  it('uses the vision model when one is configured', async () => {
    const p = provider()
    const result = await importFromPhoto(image, 'image/jpeg', { provider: p })

    expect(result.method).toBe('vision')
    expect(result.draft.title).toBe('Vision Cake')
    expect(p.extractRecipeFromImage).toHaveBeenCalledWith(image, 'image/jpeg')
    expect(result.rawText).toBeUndefined()
  })

  it('falls back to OCR when no provider is configured', async () => {
    const runOcr = vi.fn(async () => CARD)
    const result = await importFromPhoto(image, 'image/jpeg', {
      provider: null,
      runOcr,
    })

    expect(result.method).toBe('ocr')
    expect(result.draft.title).toBe("Aunt Ida's Cake")
    expect(runOcr).toHaveBeenCalledWith(image)
  })

  it('falls back to OCR when the vision call fails', async () => {
    const runOcr = vi.fn(async () => CARD)
    const p = provider({
      extractRecipeFromImage: vi.fn(async () => {
        throw new Error('model does not support images')
      }),
    })

    const result = await importFromPhoto(image, 'image/jpeg', {
      provider: p,
      runOcr,
    })

    expect(result.method).toBe('ocr')
    expect(runOcr).toHaveBeenCalledOnce()
  })

  it('returns the raw text alongside an OCR draft, hiding nothing', async () => {
    const result = await importFromPhoto(image, 'image/jpeg', {
      provider: null,
      runOcr: async () => CARD,
    })

    expect(result.rawText).toBe(CARD)
  })

  it('opens the form with the raw text rather than dead-ending on a bad scan', async () => {
    const result = await importFromPhoto(image, 'image/jpeg', {
      provider: null,
      runOcr: async () => '|||  ~~~',
    })

    expect(result.method).toBe('ocr')
    expect(result.draft.title).toBe('')
    expect(result.draft.ingredients).toEqual([])
  })

  it('surfaces an OCR engine failure, since there is nothing left to fall back to', async () => {
    await expect(
      importFromPhoto(image, 'image/jpeg', {
        provider: null,
        runOcr: async () => {
          throw new Error('worker crashed')
        },
      }),
    ).rejects.toThrow(/That photo could not be read: worker crashed/)
  })
})
