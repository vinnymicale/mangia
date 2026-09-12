import { describe, it, expect, vi, afterEach } from 'vitest'
import { OpenAiCompatibleProvider } from './openaiCompatible'

const DRAFT_JSON = JSON.stringify({
  title: 'Nonna Pasta',
  instructions: '1. Boil water.',
  ingredients: [{ quantity: 1, unit: 'lb', ingredient: 'pasta', note: null }],
})

function stubFetch(response: Partial<Response> & { json?: () => unknown }) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('OpenAiCompatibleProvider.extractRecipeFromImage', () => {
  it('sends the image as a data URI content part and parses the draft', async () => {
    const fetchMock = stubFetch({
      ok: true,
      json: async () => ({ choices: [{ message: { content: DRAFT_JSON } }] }),
    } as unknown as Response)

    const provider = new OpenAiCompatibleProvider('http://localhost:1234/v1', 'key', 'vision')
    const image = Buffer.from('fake-jpeg-bytes')
    const draft = await provider.extractRecipeFromImage(image, 'image/jpeg')

    expect(draft.title).toBe('Nonna Pasta')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const userContent = body.messages.at(-1).content
    const imagePart = userContent.find(
      (part: Record<string, unknown>) => part.type === 'image_url',
    )
    expect(imagePart.image_url.url).toBe(
      `data:image/jpeg;base64,${image.toString('base64')}`,
    )
  })

  it('throws when the model rejects the call, which is what triggers OCR', async () => {
    stubFetch({
      ok: false,
      status: 400,
      text: async () => 'model does not support images',
    } as unknown as Response)

    const provider = new OpenAiCompatibleProvider('http://localhost:1234/v1', 'key', 'text-only')
    await expect(
      provider.extractRecipeFromImage(Buffer.from('x'), 'image/jpeg'),
    ).rejects.toThrow(/LLM request failed: 400/)
  })
})
