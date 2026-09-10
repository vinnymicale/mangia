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
async function seedRecipe(title: string, tags: string[]) {
  const { createRecipe } = await import('./recipes')
  const id = await createRecipe({ title, instructions: 'Cook.', ingredients: [], tags })
  return { id }
}

describe('listTagsWithCounts', () => {
  it('reports how many recipes carry each tag, busiest first', async () => {
    const { listTagsWithCounts } = await import('./tags')
    await seedRecipe('Soup', ['winter', 'quick'])
    await seedRecipe('Stew', ['winter'])

    const rows = await listTagsWithCounts()
    const winter = rows.find((row) => row.name === 'winter')
    const quick = rows.find((row) => row.name === 'quick')
    expect(winter?.count).toBe(2)
    expect(quick?.count).toBe(1)
    expect(rows.indexOf(winter!)).toBeLessThan(rows.indexOf(quick!))
  })
})

describe('renameTag', () => {
  it('renames in place, keeping the recipes attached', async () => {
    const { renameTag, listTagsWithCounts } = await import('./tags')
    const { db } = await import('./client')
    const recipe = await seedRecipe('Chilli', ['spicey'])
    const tag = await db.tag.findFirstOrThrow({ where: { name: 'spicey' } })

    expect(await renameTag(tag.id, 'spicy')).toBe('renamed')
    const rows = await listTagsWithCounts()
    expect(rows.find((row) => row.name === 'spicey')).toBeUndefined()
    expect(rows.find((row) => row.name === 'spicy')?.count).toBe(1)
    const links = await db.recipeTag.count({ where: { recipeId: recipe.id } })
    expect(links).toBe(1)
  })

  it('merges when the new name is already taken, without duplicating a recipe', async () => {
    const { renameTag } = await import('./tags')
    const { db } = await import('./client')
    // One recipe carries both names, so a naive merge would try to write a
    // RecipeTag row that already exists and violate the composite key.
    const shared = await seedRecipe('Curry', ['hot', 'fiery'])
    await seedRecipe('Salsa', ['fiery'])
    const fiery = await db.tag.findFirstOrThrow({ where: { name: 'fiery' } })

    expect(await renameTag(fiery.id, 'hot')).toBe('merged')
    expect(await db.tag.findFirst({ where: { name: 'fiery' } })).toBeNull()
    const hot = await db.tag.findFirstOrThrow({ where: { name: 'hot' } })
    expect(await db.recipeTag.count({ where: { tagId: hot.id } })).toBe(2)
    expect(
      await db.recipeTag.count({ where: { tagId: hot.id, recipeId: shared.id } }),
    ).toBe(1)
  })

  it('reports a missing tag rather than throwing', async () => {
    const { renameTag } = await import('./tags')
    expect(await renameTag('no-such-id', 'whatever')).toBe('missing')
  })

  it('rejects a blank name', async () => {
    const { renameTag } = await import('./tags')
    const { db } = await import('./client')
    await seedRecipe('Toast', ['breakfast'])
    const tag = await db.tag.findFirstOrThrow({ where: { name: 'breakfast' } })
    expect(await renameTag(tag.id, '   ')).toBe('invalid')
    expect(await db.tag.findFirst({ where: { name: 'breakfast' } })).not.toBeNull()
  })
})

describe('deleteTag', () => {
  it('removes the tag and unlinks it, leaving the recipes alone', async () => {
    const { deleteTag } = await import('./tags')
    const { db } = await import('./client')
    const recipe = await seedRecipe('Pie', ['pastry'])
    const tag = await db.tag.findFirstOrThrow({ where: { name: 'pastry' } })

    expect(await deleteTag(tag.id)).toBe(true)
    expect(await db.tag.findFirst({ where: { name: 'pastry' } })).toBeNull()
    expect(await db.recipeTag.count({ where: { tagId: tag.id } })).toBe(0)
    // The recipe itself must survive losing a tag.
    expect(await db.recipe.findUnique({ where: { id: recipe.id } })).not.toBeNull()
  })

  it('reports a missing tag rather than throwing', async () => {
    const { deleteTag } = await import('./tags')
    expect(await deleteTag('no-such-id')).toBe(false)
  })
})
