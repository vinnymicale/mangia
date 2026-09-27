import { describe, it, expect } from 'vitest'
import {
  EMPTY_NUTRIENTS,
  NutrientsSchema,
  hasAnyNutrient,
  validateNutrientsPer100g,
  validateUnitWeight,
} from './types'

const FLOUR = {
  kcal: 364, protein: 10.3, carbs: 76.3, fat: 1, fiber: 2.7, sugar: 0.3, sodium: 2,
}

describe('validateNutrientsPer100g', () => {
  it('accepts a real food', () => {
    expect(validateNutrientsPer100g(FLOUR)).toBe(true)
  })

  it('accepts a profile with gaps', () => {
    expect(validateNutrientsPer100g({ ...EMPTY_NUTRIENTS, kcal: 40 })).toBe(true)
  })

  it('accepts pure fat and table salt at the edges', () => {
    expect(validateNutrientsPer100g({ ...EMPTY_NUTRIENTS, kcal: 884, fat: 100 })).toBe(true)
    expect(validateNutrientsPer100g({ ...EMPTY_NUTRIENTS, sodium: 38_758 })).toBe(true)
  })

  it.each([
    ['kcal over 900', { kcal: 950 }],
    ['macros over 100 g', { protein: 40, carbs: 40, fat: 40 }],
    ['fiber over carbs', { carbs: 10, fiber: 20 }],
    ['sugar over carbs', { carbs: 10, sugar: 20 }],
    ['sodium over 40 000 mg', { sodium: 50_000 }],
    ['a negative value', { protein: -1 }],
    ['a non-finite value', { fat: Number.NaN }],
  ])('rejects %s', (_, patch) => {
    expect(validateNutrientsPer100g({ ...FLOUR, ...patch })).toBe(false)
  })

  it('does not compare fiber to carbs when carbs are unknown', () => {
    expect(validateNutrientsPer100g({ ...EMPTY_NUTRIENTS, fiber: 5 })).toBe(true)
  })
})

describe('validateUnitWeight', () => {
  it.each([0, -3, 5001, Number.POSITIVE_INFINITY])('rejects %s', (grams) => {
    expect(validateUnitWeight(grams)).toBe(false)
  })

  it.each([0.5, 125, 5000])('accepts %s', (grams) => {
    expect(validateUnitWeight(grams)).toBe(true)
  })
})

describe('NutrientsSchema', () => {
  it('fills absent keys with null', () => {
    expect(NutrientsSchema.parse({ kcal: 100 })).toEqual({ ...EMPTY_NUTRIENTS, kcal: 100 })
  })

  it('rejects a negative value', () => {
    expect(NutrientsSchema.safeParse({ kcal: -1 }).success).toBe(false)
  })
})

describe('hasAnyNutrient', () => {
  it('is false only when every value is null', () => {
    expect(hasAnyNutrient(EMPTY_NUTRIENTS)).toBe(false)
    expect(hasAnyNutrient({ ...EMPTY_NUTRIENTS, sodium: 0 })).toBe(true)
  })
})
