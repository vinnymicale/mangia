import { describe, it, expect } from 'vitest'
import { db } from './client'

describe('db client', () => {
  it('connects and queries the generated schema', async () => {
    const count = await db.recipe.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
