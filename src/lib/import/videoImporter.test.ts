import { describe, it, expect, vi } from 'vitest'
import { importFromVideo } from './videoImporter'
import type { LlmProvider, RecipeDraft, VideoSource } from '@/lib/llm/types'
import type { VideoMetadata } from './videoMetadata'
import type { DownloadOutcome } from './videoDownload'

const DRAFT: RecipeDraft = {
  title: 'Cacio e Pepe',
  description: null,
  instructions: '1. Boil pasta.',
  servings: 2,
  prepMinutes: null,
  cookMinutes: 15,
  ingredients: [{ quantity: 500, unit: 'g', ingredient: 'spaghetti', note: null }],
  tags: [],
}

function fakeProvider(overrides: Partial<LlmProvider> = {}): LlmProvider {
  return {
    name: 'fake',
    extractRecipe: vi.fn(async () => DRAFT),
    extractRecipeFromImage: vi.fn(async () => DRAFT),
    extractRecipeFromVideo: vi.fn(async () => DRAFT),
    parseIngredientLines: vi.fn(async () => []),
    ...overrides,
  }
}

const RECIPE_CAPTION =
  'Cacio e pepe. 500g spaghetti, 100g pecorino romano, 2 tsp black pepper. ' +
  'Boil the pasta, toast the pepper, emulsify with the starchy water.'

function meta(caption: string): VideoMetadata {
  return { title: 'Cacio e Pepe', caption, author: 'Nonna' }
}

function deps(over: {
  metadata?: VideoMetadata
  provider?: LlmProvider
  download?: DownloadOutcome
} = {}) {
  return {
    provider: over.provider ?? fakeProvider(),
    fetchMetadata: vi.fn(async () => over.metadata ?? meta(RECIPE_CAPTION)),
    downloadVideo: vi.fn(async () => over.download ?? ({ ok: false, reason: 'unavailable' } as DownloadOutcome)),
  }
}

describe('importFromVideo', () => {
  it('reads a substantial caption without touching the video', async () => {
    const d = deps()
    const result = await importFromVideo('https://www.instagram.com/reel/x/', d)

    expect(result.method).toBe('video-caption')
    expect(result.draft).toEqual(DRAFT)
    expect(d.provider.extractRecipe).toHaveBeenCalledOnce()
    expect(d.provider.extractRecipeFromVideo).not.toHaveBeenCalled()
    expect(d.downloadVideo).not.toHaveBeenCalled()
  })

  it('hands youtube to the model as a url, never as bytes', async () => {
    const d = deps({ metadata: meta('Subscribe for more!') })
    const result = await importFromVideo('https://youtu.be/abc', d)

    expect(result.method).toBe('video-model')
    expect(d.downloadVideo).not.toHaveBeenCalled()
    const source = vi.mocked(d.provider.extractRecipeFromVideo).mock.calls[0][0] as VideoSource
    expect(source).toEqual({ kind: 'url', url: 'https://youtu.be/abc' })
  })

  it('downloads instagram and tiktok, since no model can fetch them', async () => {
    const data = Buffer.from('mp4')
    const d = deps({
      metadata: meta('link in bio'),
      download: { ok: true, data, mimeType: 'video/mp4' },
    })
    const result = await importFromVideo('https://www.tiktok.com/@a/video/1', d)

    expect(result.method).toBe('video-model')
    expect(d.downloadVideo).toHaveBeenCalledOnce()
    const source = vi.mocked(d.provider.extractRecipeFromVideo).mock.calls[0][0] as VideoSource
    expect(source).toEqual({ kind: 'bytes', data, mimeType: 'video/mp4' })
  })

  // The thin caption is worth less than a video read, but more than an error.
  it('falls back to a thin caption when the video cannot be read', async () => {
    const d = deps({
      metadata: meta('Best carbonara ever! 3 eggs and guanciale.'),
      download: { ok: false, reason: 'unavailable' },
      provider: fakeProvider({
        extractRecipeFromVideo: vi.fn(async () => {
          throw new Error('This model cannot watch video.')
        }),
      }),
    })

    const result = await importFromVideo('https://www.tiktok.com/@a/video/1', d)

    expect(result.method).toBe('video-caption')
    expect(result.draft).toEqual(DRAFT)
  })

  it('escalates a caption with no quantities in it', async () => {
    const d = deps({ metadata: meta('The best pasta you will ever make. Recipe below!') })
    const result = await importFromVideo('https://youtu.be/abc', d)

    expect(result.method).toBe('video-model')
    expect(d.provider.extractRecipe).not.toHaveBeenCalled()
  })

  it('reports a useful error when every rung fails', async () => {
    const d = deps({
      metadata: { title: null, caption: '', author: null },
      download: { ok: false, reason: 'unavailable' },
      provider: fakeProvider({
        extractRecipeFromVideo: vi.fn(async () => {
          throw new Error('This model cannot watch video.')
        }),
      }),
    })

    await expect(importFromVideo('https://youtu.be/abc', d)).rejects.toThrow(
      /cannot watch video/,
    )
  })

  it('names the download failure when there is no caption to fall back on', async () => {
    const d = deps({
      metadata: { title: null, caption: '', author: null },
      download: { ok: false, reason: 'timeout' },
    })

    await expect(
      importFromVideo('https://www.tiktok.com/@a/video/1', d),
    ).rejects.toThrow(/timed out/i)
  })

  it('refuses a url that is not a supported video', async () => {
    await expect(
      importFromVideo('https://example.com/recipes/pasta', deps()),
    ).rejects.toThrow(/not a supported video/i)
  })

  it('keeps the source url on the result so the form can cite it', async () => {
    const result = await importFromVideo('https://youtu.be/abc', deps())
    expect(result.sourceUrl).toBe('https://youtu.be/abc')
  })

  it('gives the caption model the title and author for context', async () => {
    const d = deps()
    await importFromVideo('https://www.instagram.com/reel/x/', d)

    const text = vi.mocked(d.provider.extractRecipe).mock.calls[0][0]
    expect(text).toContain('Cacio e Pepe')
    expect(text).toContain(RECIPE_CAPTION)
  })
})
