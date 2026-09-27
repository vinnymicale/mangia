import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'

let cleanup: () => void

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

afterAll(() => cleanup())

// The db singleton binds DATABASE_URL at construction, so every module that
// touches it has to be imported after beforeAll has redirected the env.
function post(body: unknown): Request {
  return new Request('http://x/api/recipes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const BASE = { title: 'Nonna Card', instructions: 'Mix. Bake.' }

describe('POST /api/recipes', () => {
  it('stores a photo sent alongside the recipe', async () => {
    const { POST } = await import('./route')
    const { getRecipePhoto } = await import('@/lib/db/photos')

    const bytes = Buffer.from([0xff, 0xd8, 0x00, 0x41])
    const response = await POST(
      post({ ...BASE, photo: { data: bytes.toString('base64'), mimeType: 'image/jpeg' } }),
    )

    expect(response.status).toBe(201)
    const { id } = await response.json()
    const stored = await getRecipePhoto(id)
    expect(stored!.mimeType).toBe('image/jpeg')
    expect(Buffer.from(stored!.data).equals(bytes)).toBe(true)
  })

  it('saves without a photo, which is the default', async () => {
    const { POST } = await import('./route')
    const { getRecipePhoto } = await import('@/lib/db/photos')

    const response = await POST(post(BASE))

    expect(response.status).toBe(201)
    const { id } = await response.json()
    expect(await getRecipePhoto(id)).toBeNull()
  })

  it('rejects a photo type it would not serve', async () => {
    const { POST } = await import('./route')

    const response = await POST(
      post({ ...BASE, photo: { data: 'PHNjcmlwdD4=', mimeType: 'text/html' } }),
    )

    expect(response.status).toBe(400)
  })

  it('saves the recipe even when storing the photo fails', async () => {
    const { POST } = await import('./route')

    // A photo is a nicety; the recipe the cook just typed is not. Base64 that
    // decodes to nothing still leaves a saved recipe behind.
    const response = await POST(
      post({ ...BASE, title: 'Salvaged', photo: { data: '', mimeType: 'image/png' } }),
    )

    expect(response.status).toBe(201)
  })
})

describe('POST /api/recipes with nutritionOverride', () => {
  it('stores the override given with a new recipe', async () => {
    const { POST } = await import('./route')
    const { getOverride } = await import('@/lib/db/nutrition')

    const response = await POST(post({ ...BASE, nutritionOverride: { kcal: 640, note: 'From source page' } }))

    const { id } = await response.json()
    expect(await getOverride(id)).toMatchObject({ kcal: 640, note: 'From source page' })
  })

  it('rejects an override with no values', async () => {
    const { POST } = await import('./route')
    expect((await POST(post({ ...BASE, nutritionOverride: { note: 'x' } }))).status).toBe(400)
  })
})
