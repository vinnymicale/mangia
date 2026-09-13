import { describe, it, expect, vi, beforeEach } from 'vitest'

// Only the database read is stubbed. `isPhotoMimeType` is a pure guard and is
// the thing under test in the type-fallback case, so it stays real.
vi.mock('@/lib/db/photos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/photos')>()),
  getRecipePhoto: vi.fn(),
}))

import { getRecipePhoto } from '@/lib/db/photos'
import { GET } from './route'

function get(id: string) {
  return GET(new Request(`http://x/api/recipes/${id}/photo`), {
    params: Promise.resolve({ id }),
  })
}

beforeEach(() => {
  vi.mocked(getRecipePhoto).mockReset()
})

describe('GET /api/recipes/[id]/photo', () => {
  it('serves the stored bytes under their own type', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0x00, 0x41])
    vi.mocked(getRecipePhoto).mockResolvedValue({ data: bytes, mimeType: 'image/webp' })

    const response = await get('abc')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('content-length')).toBe('4')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  })

  it('caches privately and forever, since a photo is never edited in place', async () => {
    vi.mocked(getRecipePhoto).mockResolvedValue({
      data: new Uint8Array([1]),
      mimeType: 'image/jpeg',
    })

    const response = await get('abc')

    expect(response.headers.get('cache-control')).toBe('private, max-age=31536000, immutable')
  })

  it('404s when the recipe has no photo', async () => {
    vi.mocked(getRecipePhoto).mockResolvedValue(null)

    const response = await get('abc')

    expect(response.status).toBe(404)
  })

  it('never serves an unexpected type back under its own name', async () => {
    vi.mocked(getRecipePhoto).mockResolvedValue({
      data: new Uint8Array([0x3c, 0x21]),
      mimeType: 'text/html',
    })

    const response = await get('abc')

    expect(response.headers.get('content-type')).toBe('application/octet-stream')
  })

  it('sends the headers that stop bytes being treated as a document', async () => {
    vi.mocked(getRecipePhoto).mockResolvedValue({
      data: new Uint8Array([1]),
      mimeType: 'image/jpeg',
    })

    const response = await get('abc')

    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox")
    expect(response.headers.get('content-disposition')).toBe('inline; filename="photo"')
  })
})
