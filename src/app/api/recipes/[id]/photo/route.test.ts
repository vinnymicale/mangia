import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/photos', () => ({ getRecipePhoto: vi.fn() }))

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
})
