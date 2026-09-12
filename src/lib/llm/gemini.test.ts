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
