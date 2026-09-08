import { describe, it, expect } from 'vitest'
import { parseQuantity } from './fractions'

describe('parseQuantity', () => {
  it('parses whole numbers', () => {
    expect(parseQuantity('2')).toBe(2)
  })

  it('parses decimals', () => {
    expect(parseQuantity('1.5')).toBe(1.5)
  })

  it('parses ascii fractions', () => {
    expect(parseQuantity('1/2')).toBe(0.5)
    expect(parseQuantity('3/4')).toBe(0.75)
  })

  it('parses unicode fractions', () => {
    expect(parseQuantity('½')).toBe(0.5)
    expect(parseQuantity('¼')).toBe(0.25)
    expect(parseQuantity('⅓')).toBeCloseTo(0.3333, 3)
  })

  it('parses mixed ascii numbers', () => {
    expect(parseQuantity('1 1/2')).toBe(1.5)
  })

  it('parses mixed unicode numbers', () => {
    expect(parseQuantity('1½')).toBe(1.5)
    expect(parseQuantity('2 ¼')).toBe(2.25)
  })

  it('parses ranges by taking the lower bound', () => {
    expect(parseQuantity('2-3')).toBe(2)
    expect(parseQuantity('2 to 3')).toBe(2)
    expect(parseQuantity('2–3')).toBe(2)
  })

  it('returns null for non-quantities', () => {
    expect(parseQuantity('flour')).toBeNull()
    expect(parseQuantity('')).toBeNull()
  })
})
