import { describe, it, expect, vi } from 'vitest'
import { GeminiProvider } from './gemini'

const DRAFT_JSON = JSON.stringify({
  title: 'Nonna Pasta',
  instructions: '1. Boil water.',
  ingredients: [{ quantity: 1, unit: 'lb', ingredient: 'pasta', note: null }],
})

/** Replaces the SDK client with a stub, so no network or key is needed. */
function stubClient(provider: GeminiProvider, text: string) {
  const generateContent = vi.fn().mockResolvedValue({ text })
  // The client is private by design; a test double is the one legitimate reason
  // to reach past that.
  ;(provider as unknown as { client: unknown }).client = {
    models: { generateContent },
  }
  return generateContent
}

describe('GeminiProvider.extractRecipeFromImage', () => {
  it('sends the image as an inline data part and parses the draft', async () => {
    const provider = new GeminiProvider('key', 'gemini-test')
    const generateContent = stubClient(provider, DRAFT_JSON)

    const image = Buffer.from('fake-jpeg-bytes')
    const draft = await provider.extractRecipeFromImage(image, 'image/jpeg')

    expect(draft.title).toBe('Nonna Pasta')
    expect(draft.ingredients).toHaveLength(1)

    const call = generateContent.mock.calls[0][0]
    const parts = call.contents.parts
    const inline = parts.find((part: Record<string, unknown>) => 'inlineData' in part)
    expect(inline.inlineData.mimeType).toBe('image/jpeg')
    expect(inline.inlineData.data).toBe(image.toString('base64'))
    expect(call.config.responseMimeType).toBe('application/json')
  })

  it('tolerates a fenced response', async () => {
    const provider = new GeminiProvider('key', 'gemini-test')
    stubClient(provider, '```json\n' + DRAFT_JSON + '\n```')

    const draft = await provider.extractRecipeFromImage(Buffer.from('x'), 'image/png')
    expect(draft.title).toBe('Nonna Pasta')
  })
})

describe('GeminiProvider.extractRecipeFromVideo', () => {
  // Gemini fetches a YouTube URL itself, which is the whole reason YouTube
  // never goes through yt-dlp. Sending it as bytes would be a regression.
  it('passes a url straight to the model as fileData', async () => {
    const provider = new GeminiProvider('key', 'gemini-test')
    const generateContent = stubClient(provider, DRAFT_JSON)

    const draft = await provider.extractRecipeFromVideo({
      kind: 'url',
      url: 'https://youtu.be/dQw4w9WgXcQ',
    })

    expect(draft.title).toBe('Nonna Pasta')
    const parts = generateContent.mock.calls[0][0].contents.parts
    const media = parts.find((part: Record<string, unknown>) => 'fileData' in part)
    expect(media.fileData.fileUri).toBe('https://youtu.be/dQw4w9WgXcQ')
    expect(parts.some((part: Record<string, unknown>) => 'inlineData' in part)).toBe(false)
  })

  it('sends downloaded bytes inline, base64 encoded', async () => {
    const provider = new GeminiProvider('key', 'gemini-test')
    const generateContent = stubClient(provider, DRAFT_JSON)

    const data = Buffer.from('fake-mp4-bytes')
    await provider.extractRecipeFromVideo({ kind: 'bytes', data, mimeType: 'video/mp4' })

    const parts = generateContent.mock.calls[0][0].contents.parts
    const media = parts.find((part: Record<string, unknown>) => 'inlineData' in part)
    expect(media.inlineData.mimeType).toBe('video/mp4')
    expect(media.inlineData.data).toBe(data.toString('base64'))
  })

  it('asks for json and tolerates a fenced response', async () => {
    const provider = new GeminiProvider('key', 'gemini-test')
    const generateContent = stubClient(provider, '```json\n' + DRAFT_JSON + '\n```')

    const draft = await provider.extractRecipeFromVideo({ kind: 'url', url: 'https://youtu.be/x' })

    expect(draft.title).toBe('Nonna Pasta')
    expect(generateContent.mock.calls[0][0].config.responseMimeType).toBe('application/json')
  })

  it('rejects a response that is not a recipe draft', async () => {
    const provider = new GeminiProvider('key', 'gemini-test')
    stubClient(provider, JSON.stringify({ nonsense: true }))

    await expect(
      provider.extractRecipeFromVideo({ kind: 'url', url: 'https://youtu.be/x' }),
    ).rejects.toThrow()
  })
})
