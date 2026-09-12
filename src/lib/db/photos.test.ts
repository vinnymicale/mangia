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
async function seedRecipe(title: string) {
  const { createRecipe } = await import('./recipes')
  return createRecipe({ title, instructions: 'Cook.', ingredients: [] })
}

describe('setRecipePhoto', () => {
  it('stores bytes that come back byte-for-byte', async () => {
    const { setRecipePhoto, getRecipePhoto } = await import('./photos')
    const id = await seedRecipe('Nonna Card')
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x10])

    await setRecipePhoto(id, bytes, 'image/jpeg')

    const photo = await getRecipePhoto(id)
    expect(photo).not.toBeNull()
    expect(photo!.mimeType).toBe('image/jpeg')
    expect(Buffer.from(photo!.data).equals(bytes)).toBe(true)
  })

  it('replaces the existing photo rather than adding a second', async () => {
    const { setRecipePhoto, getRecipePhoto } = await import('./photos')
    const id = await seedRecipe('Re-shot Card')

    await setRecipePhoto(id, Buffer.from([1]), 'image/png')
    await setRecipePhoto(id, Buffer.from([2, 2]), 'image/webp')

    const photo = await getRecipePhoto(id)
    expect(photo!.mimeType).toBe('image/webp')
    expect(Buffer.from(photo!.data).equals(Buffer.from([2, 2]))).toBe(true)
  })

  it('returns null for a recipe with no photo', async () => {
    const { getRecipePhoto } = await import('./photos')
    const id = await seedRecipe('Typed Out')

    expect(await getRecipePhoto(id)).toBeNull()
  })

  it('returns null for an unknown recipe rather than throwing', async () => {
    const { getRecipePhoto } = await import('./photos')

    expect(await getRecipePhoto('no-such-recipe')).toBeNull()
  })

  it('takes the photo with the recipe when the recipe is deleted', async () => {
    const { setRecipePhoto, getRecipePhoto } = await import('./photos')
    const { deleteRecipe } = await import('./recipes')
    const id = await seedRecipe('Doomed')
    await setRecipePhoto(id, Buffer.from([9]), 'image/jpeg')

    await deleteRecipe(id)

    expect(await getRecipePhoto(id)).toBeNull()
  })
})
