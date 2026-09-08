import { describe, it, expect } from 'vitest'
import { isLowConfidence, type ParsedIngredient } from './types'

describe('isLowConfidence', () => {
  it('flags a line with no ingredient name', () => {
    const p: ParsedIngredient = {
      quantity: 2, unit: 'cups', ingredient: '', note: null,
      rawText: '2 cups', confidence: 'low',
    }
    expect(isLowConfidence(p)).toBe(true)
  })

  it('does not flag a fully parsed line', () => {
    const p: ParsedIngredient = {
      quantity: 2, unit: 'cups', ingredient: 'flour', note: null,
      rawText: '2 cups flour', confidence: 'high',
    }
    expect(isLowConfidence(p)).toBe(false)
  })
})
