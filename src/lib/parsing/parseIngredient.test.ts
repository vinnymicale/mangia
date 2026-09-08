import { describe, it, expect } from 'vitest'
import { parseIngredientLine, parseIngredientBlob } from './parseIngredient'

describe('parseIngredientLine', () => {
  it('parses quantity, unit, and ingredient', () => {
    const r = parseIngredientLine('2 cups all-purpose flour')
    expect(r.quantity).toBe(2)
    expect(r.unit).toBe('cup')
    expect(r.ingredient).toBe('all-purpose flour')
    expect(r.confidence).toBe('high')
  })

  it('always preserves the raw text', () => {
    const r = parseIngredientLine('2 cups all-purpose flour')
    expect(r.rawText).toBe('2 cups all-purpose flour')
  })

  it('extracts a trailing note after a comma', () => {
    const r = parseIngredientLine('3 cloves garlic, minced')
    expect(r.quantity).toBe(3)
    expect(r.unit).toBe('clove')
    expect(r.ingredient).toBe('garlic')
    expect(r.note).toBe('minced')
  })

  it('parses unitless counts', () => {
    const r = parseIngredientLine('2 eggs')
    expect(r.quantity).toBe(2)
    expect(r.unit).toBeNull()
    expect(r.ingredient).toBe('eggs')
    expect(r.confidence).toBe('high')
  })

  it('parses unicode fractions', () => {
    const r = parseIngredientLine('½ tsp kosher salt')
    expect(r.quantity).toBe(0.5)
    expect(r.unit).toBe('teaspoon')
    expect(r.ingredient).toBe('kosher salt')
  })

  it('parses mixed numbers', () => {
    const r = parseIngredientLine('1 1/2 cups whole milk')
    expect(r.quantity).toBe(1.5)
    expect(r.unit).toBe('cup')
    expect(r.ingredient).toBe('whole milk')
  })

  it('parses ranges using the lower bound', () => {
    const r = parseIngredientLine('2-3 tablespoons olive oil')
    expect(r.quantity).toBe(2)
    expect(r.unit).toBe('tablespoon')
    expect(r.ingredient).toBe('olive oil')
  })

  it('captures a parenthetical amount as a note', () => {
    const r = parseIngredientLine('1 can (14 oz) diced tomatoes')
    expect(r.quantity).toBe(1)
    expect(r.unit).toBe('can')
    expect(r.ingredient).toBe('diced tomatoes')
    expect(r.note).toBe('14 oz')
  })

  it('handles the "Zest of 1 lemon" leading-note form', () => {
    const r = parseIngredientLine('Zest of 1 lemon')
    expect(r.quantity).toBe(1)
    expect(r.ingredient).toBe('lemon')
    expect(r.note).toBe('zest')
  })

  it('flags an unparseable line as low confidence but keeps the text', () => {
    const r = parseIngredientLine('a splash of olive oil')
    expect(r.confidence).toBe('low')
    expect(r.quantity).toBeNull()
    expect(r.rawText).toBe('a splash of olive oil')
    expect(r.ingredient).toBe('a splash of olive oil')
  })

  it('strips a leading list bullet', () => {
    const r = parseIngredientLine('- 2 cups flour')
    expect(r.quantity).toBe(2)
    expect(r.ingredient).toBe('flour')
  })

  it('treats a bare ingredient with no quantity as low confidence', () => {
    const r = parseIngredientLine('salt to taste')
    expect(r.quantity).toBeNull()
    expect(r.confidence).toBe('low')
  })
})

describe('parseIngredientBlob', () => {
  it('parses each non-empty line', () => {
    const rows = parseIngredientBlob('2 cups flour\n\n1 tsp salt\n')
    expect(rows).toHaveLength(2)
    expect(rows[0].ingredient).toBe('flour')
    expect(rows[1].ingredient).toBe('salt')
  })

  it('returns an empty array for empty input', () => {
    expect(parseIngredientBlob('   \n  ')).toHaveLength(0)
  })
})
