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
async function seed(title: string, tags: string[]) {
  const { createRecipe } = await import('./recipes')
  return createRecipe({ title, instructions: 'Cook.', ingredients: [], tags })
}

describe('TAG_KINDS', () => {
  it('offers a closed set that always includes freeform', async () => {
    const { TAG_KINDS, isTagKind } = await import('./tagKinds')
    // freeform is the default in the schema, so it has to stay assignable:
    // a tag must always be able to go back to having no taxonomy.
    expect(TAG_KINDS).toContain('freeform')
    expect(isTagKind('cuisine')).toBe(true)
    expect(isTagKind('nonsense')).toBe(false)
  })
})

describe('setTagKind', () => {
  it('classifies a tag and reports it back', async () => {
    await seed('Ragu', ['italian'])
    const { setTagKind } = await import('./tagKinds')
    const { listTagsByKind } = await import('./tagKinds')

    expect(await setTagKind('italian', 'cuisine')).toBe(true)
    const groups = await listTagsByKind()
    const cuisine = groups.find((group) => group.kind === 'cuisine')
    expect(cuisine?.tags.map((tag) => tag.name)).toContain('italian')
  })

  it('reports false for a tag that does not exist', async () => {
    const { setTagKind } = await import('./tagKinds')
    expect(await setTagKind('no-such-tag', 'cuisine')).toBe(false)
  })

  it('refuses a kind outside the taxonomy', async () => {
    await seed('Soup', ['brothy'])
    const { setTagKind } = await import('./tagKinds')
    // Rejected rather than stored: an open string column would let the
    // taxonomy drift into exactly the free-for-all it exists to organise.
    await expect(setTagKind('brothy', 'invented' as never)).rejects.toThrow()
  })
})

describe('listTagsByKind', () => {
  it('groups tags under their kind with freeform last', async () => {
    await seed('Pesto', ['ligurian', 'summer', 'scribble'])
    const { setTagKind, listTagsByKind } = await import('./tagKinds')
    await setTagKind('ligurian', 'cuisine')
    await setTagKind('summer', 'season')

    const groups = await listTagsByKind()
    const kinds = groups.map((group) => group.kind)
    // freeform is the unsorted pile; it belongs at the bottom of a settings
    // page, not competing with the categories the user actually curated.
    expect(kinds[kinds.length - 1]).toBe('freeform')
    expect(groups.find((g) => g.kind === 'season')?.tags.map((t) => t.name)).toContain(
      'summer',
    )
    expect(groups.find((g) => g.kind === 'freeform')?.tags.map((t) => t.name)).toContain(
      'scribble',
    )
  })

  it('carries the recipe count through, so a kind can be judged by weight', async () => {
    await seed('Cacio', ['roman'])
    await seed('Carbonara', ['roman'])
    const { setTagKind, listTagsByKind } = await import('./tagKinds')
    await setTagKind('roman', 'cuisine')

    const groups = await listTagsByKind()
    const roman = groups
      .find((group) => group.kind === 'cuisine')
      ?.tags.find((tag) => tag.name === 'roman')
    expect(roman?.count).toBe(2)
  })
})
