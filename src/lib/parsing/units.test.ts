import { describe, it, expect } from 'vitest'
import { normalizeUnit, areUnitsCompatible, UNIT_BASE_FACTORS } from './units'

describe('normalizeUnit', () => {
  it('normalizes tablespoon aliases', () => {
    expect(normalizeUnit('tbsp')).toBe('tablespoon')
    expect(normalizeUnit('T')).toBe('tablespoon')
    expect(normalizeUnit('Tablespoons')).toBe('tablespoon')
  })

  it('normalizes teaspoon aliases', () => {
    expect(normalizeUnit('tsp')).toBe('teaspoon')
    expect(normalizeUnit('t')).toBe('teaspoon')
  })

  it('normalizes weight and volume units', () => {
    expect(normalizeUnit('g')).toBe('gram')
    expect(normalizeUnit('lbs')).toBe('pound')
    expect(normalizeUnit('oz')).toBe('ounce')
    expect(normalizeUnit('cups')).toBe('cup')
  })

  it('normalizes countable units', () => {
    expect(normalizeUnit('cloves')).toBe('clove')
    expect(normalizeUnit('can')).toBe('can')
  })

  it('returns null for words that are not units', () => {
    expect(normalizeUnit('flour')).toBeNull()
    expect(normalizeUnit('chicken')).toBeNull()
  })
})

describe('areUnitsCompatible', () => {
  it('treats identical units as compatible', () => {
    expect(areUnitsCompatible('clove', 'clove')).toBe(true)
  })

  it('treats units in the same group as compatible', () => {
    expect(areUnitsCompatible('teaspoon', 'tablespoon')).toBe(true)
    expect(areUnitsCompatible('gram', 'kilogram')).toBe(true)
  })

  it('treats volume and weight as incompatible', () => {
    expect(areUnitsCompatible('cup', 'gram')).toBe(false)
  })

  it('treats two unitless quantities as compatible', () => {
    expect(areUnitsCompatible(null, null)).toBe(true)
  })

  it('treats unitless and united as incompatible', () => {
    expect(areUnitsCompatible(null, 'cup')).toBe(false)
  })
})

describe('UNIT_BASE_FACTORS', () => {
  it('expresses volume units in teaspoons', () => {
    expect(UNIT_BASE_FACTORS.cup).toBe(48)
    expect(UNIT_BASE_FACTORS.tablespoon).toBe(3)
    expect(UNIT_BASE_FACTORS.gallon).toBe(768)
  })

  it('covers every unit in a compatibility group', () => {
    const grouped = [
      'teaspoon', 'tablespoon', 'cup', 'fluidOunce', 'pint', 'quart',
      'gallon', 'milliliter', 'liter', 'gram', 'kilogram', 'ounce', 'pound',
    ]
    for (const unit of grouped) {
      expect(UNIT_BASE_FACTORS[unit]).toBeGreaterThan(0)
    }
  })
})
