import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'

let cleanup: () => void

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

afterAll(() => cleanup())

describe('normalizeIngredientName', () => {
  it('lowercases and trims', async () => {
    const { normalizeIngredientName } = await import('./ingredients')
    expect(normalizeIngredientName('  All-Purpose Flour ')).toBe('all-purpose flour')
  })

  it('collapses internal whitespace', async () => {
    const { normalizeIngredientName } = await import('./ingredients')
    expect(normalizeIngredientName('kosher   salt')).toBe('kosher salt')
  })
})

describe('resolveIngredient', () => {
  it('creates an ingredient that does not exist and reports it as new', async () => {
    const { resolveIngredient } = await import('./ingredients')
    const r = await resolveIngredient('garlic')
    expect(r.name).toBe('garlic')
    expect(r.isNew).toBe(true)
  })

  it('returns the existing ingredient on a second call', async () => {
    const { resolveIngredient } = await import('./ingredients')
    const first = await resolveIngredient('onion')
    const second = await resolveIngredient('Onion')
    expect(second.id).toBe(first.id)
    expect(second.isNew).toBe(false)
  })

  it('resolves through an alias to the canonical ingredient', async () => {
    const { resolveIngredient, linkAlias } = await import('./ingredients')
    const canonical = await resolveIngredient('green onion')
    await linkAlias('scallions', canonical.name)
    const viaAlias = await resolveIngredient('scallions')
    expect(viaAlias.id).toBe(canonical.id)
    expect(viaAlias.isNew).toBe(false)
  })
})

describe('findUnknownNames', () => {
  it('returns only names with no ingredient or alias', async () => {
    const { resolveIngredient, findUnknownNames } = await import('./ingredients')
    await resolveIngredient('butter')
    const unknown = await findUnknownNames(['butter', 'gochujang'])
    expect(unknown).toEqual(['gochujang'])
  })
})
