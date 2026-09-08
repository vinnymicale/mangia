import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'

let cleanup: () => void

// The `db` singleton reads DATABASE_URL when it is constructed, so the schema
// has to exist and the env has to point at it before './client' is imported.
beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

afterAll(() => cleanup())

describe('db client', () => {
  it('connects and queries the generated schema', async () => {
    const { db } = await import('./client')
    const count = await db.recipe.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
