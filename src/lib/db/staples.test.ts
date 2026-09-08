import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'

let cleanup: () => void

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

afterAll(() => cleanup())

// The database is created once for the file, so each test clears the table it
// asserts counts against.
beforeEach(async () => {
  const { db } = await import('./client')
  await db.pantryStaple.deleteMany()
})

describe('staples', () => {
  it('adds and lists staples alphabetically', async () => {
    const { listStaples, addStaple } = await import('./staples')
    await addStaple('Olive Oil')
    await addStaple('black pepper')
    const rows = await listStaples()
    expect(rows.map((row) => row.name)).toEqual(['black pepper', 'olive oil'])
  })

  it('is idempotent on the normalized name', async () => {
    const { listStaples, addStaple } = await import('./staples')
    const first = await addStaple('Kosher Salt')
    const second = await addStaple('  kosher salt ')
    expect(second.id).toBe(first.id)
    expect(await listStaples()).toHaveLength(1)
  })

  it('removes a staple', async () => {
    const { listStaples, addStaple, removeStaple } = await import('./staples')
    const staple = await addStaple('flour')
    await removeStaple(staple.id)
    expect(await listStaples()).toHaveLength(0)
  })
})
