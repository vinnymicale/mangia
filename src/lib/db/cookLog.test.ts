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

describe('logCook', () => {
  it('records an entry and advances the recipe timestamp', async () => {
    const { logCook } = await import('./cookLog')
    const { getRecipe } = await import('./recipes')
    const id = await seedRecipe('Chili')

    const entry = await logCook(id, { note: 'Needed more cumin.' })

    expect(entry).not.toBeNull()
    expect(entry!.note).toBe('Needed more cumin.')
    const recipe = await getRecipe(id)
    expect(recipe!.lastCookedAt?.getTime()).toBe(entry!.cookedAt.getTime())
  })

  it('keeps every cook rather than overwriting the last one', async () => {
    const { logCook, listCookLog } = await import('./cookLog')
    const id = await seedRecipe('Ramen')

    await logCook(id, { cookedAt: new Date('2026-01-01T12:00:00Z') })
    await logCook(id, { cookedAt: new Date('2026-02-01T12:00:00Z') })

    const entries = await listCookLog(id)
    expect(entries).toHaveLength(2)
    // Most recent first: the history is read newest-down.
    expect(entries[0].cookedAt.toISOString()).toBe('2026-02-01T12:00:00.000Z')
  })

  it('does not move lastCookedAt backwards when backfilling an older cook', async () => {
    const { logCook } = await import('./cookLog')
    const { getRecipe } = await import('./recipes')
    const id = await seedRecipe('Risotto')

    await logCook(id, { cookedAt: new Date('2026-05-01T12:00:00Z') })
    await logCook(id, { cookedAt: new Date('2026-01-01T12:00:00Z') })

    const recipe = await getRecipe(id)
    expect(recipe!.lastCookedAt?.toISOString()).toBe('2026-05-01T12:00:00.000Z')
  })

  it('returns null for a recipe that does not exist', async () => {
    const { logCook } = await import('./cookLog')
    expect(await logCook('nope', {})).toBeNull()
  })
})

describe('deleteCookLogEntry', () => {
  it('removes an entry and rolls lastCookedAt back to the previous cook', async () => {
    const { logCook, deleteCookLogEntry } = await import('./cookLog')
    const { getRecipe } = await import('./recipes')
    const id = await seedRecipe('Paella')

    await logCook(id, { cookedAt: new Date('2026-03-01T12:00:00Z') })
    const latest = await logCook(id, { cookedAt: new Date('2026-04-01T12:00:00Z') })

    expect(await deleteCookLogEntry(latest!.id)).toBe(true)

    // Deleting the most recent cook has to restore the one before it, or the
    // recipe claims a cook that no longer exists in the log.
    const recipe = await getRecipe(id)
    expect(recipe!.lastCookedAt?.toISOString()).toBe('2026-03-01T12:00:00.000Z')
  })

  it('clears lastCookedAt when the only entry is removed', async () => {
    const { logCook, deleteCookLogEntry } = await import('./cookLog')
    const { getRecipe } = await import('./recipes')
    const id = await seedRecipe('Gumbo')

    const only = await logCook(id, {})
    await deleteCookLogEntry(only!.id)

    const recipe = await getRecipe(id)
    expect(recipe!.lastCookedAt).toBeNull()
  })
})

describe('recentCooks', () => {
  it('lists cooks across all recipes, newest first, with the title attached', async () => {
    const { logCook, recentCooks } = await import('./cookLog')
    const soup = await seedRecipe('Minestrone')
    const bread = await seedRecipe('Focaccia')

    await logCook(soup, { cookedAt: new Date('2026-06-01T12:00:00Z') })
    await logCook(bread, { cookedAt: new Date('2026-07-01T12:00:00Z') })

    // Scoped to this test's own recipes: the suite shares one database, and
    // other tests log cooks dated now, which outrank these fixtures.
    const rows = (await recentCooks(100)).filter(
      (row) => row.recipeId === soup || row.recipeId === bread,
    )
    expect(rows[0].title).toBe('Focaccia')
    expect(rows[1].title).toBe('Minestrone')
  })
})

describe('cookStats', () => {
  it('counts cooks per recipe, busiest first', async () => {
    const { logCook, cookStats } = await import('./cookLog')
    const often = await seedRecipe('Weeknight Pasta')
    const once = await seedRecipe('Beef Wellington')

    await logCook(often, {})
    await logCook(often, {})
    await logCook(once, {})

    const rows = await cookStats()
    const top = rows.find((row) => row.title === 'Weeknight Pasta')
    const rare = rows.find((row) => row.title === 'Beef Wellington')
    expect(top!.count).toBe(2)
    expect(rare!.count).toBe(1)
    expect(rows.indexOf(top!)).toBeLessThan(rows.indexOf(rare!))
  })
})
