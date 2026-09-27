import { describe, it, expect } from 'vitest'
import { parseMatchFoods, parseNutrition, parseUnitWeights } from './nutrition'

const ITEMS = [
  { name: 'onion', candidates: [{ fdcId: 1, description: 'Onions, raw' }] },
  { name: 'butter', candidates: [{ fdcId: 2, description: 'Butter, salted' }] },
]

describe('parseMatchFoods', () => {
  it('reads the wrapped list in order', () => {
    expect(parseMatchFoods('{"matches":[1,null]}', ITEMS)).toEqual([1, null])
  })

  it('accepts a bare array and a fenced response', () => {
    expect(parseMatchFoods('```json\n[1,2]\n```', ITEMS)).toEqual([1, 2])
  })

  it('drops an ID that is not among that item\'s candidates', () => {
    expect(parseMatchFoods('{"matches":[2,99]}', ITEMS)).toEqual([null, null])
  })

  it('rejects a list of the wrong length', () => {
    expect(() => parseMatchFoods('{"matches":[1]}', ITEMS)).toThrow(/Expected 2/)
  })
})

describe('parseUnitWeights', () => {
  const items = [{ name: 'onion', unit: null }, { name: 'flour', unit: 'cup' }, { name: 'salt', unit: 'pinch' }]

  it('keeps positive grams and nulls the rest', () => {
    expect(parseUnitWeights('{"grams":[110,0,null]}', items)).toEqual([110, null, null])
  })

  it('rejects non-numbers', () => {
    expect(() => parseUnitWeights('{"grams":["110",1,2]}', items)).toThrow()
  })
})

describe('parseNutrition', () => {
  it('fills missing values with null', () => {
    expect(parseNutrition('{"kcal":40,"protein":1.1}')).toEqual({
      kcal: 40, protein: 1.1, carbs: null, fat: null, fiber: null, sugar: null, sodium: null,
    })
  })

  it('rejects a negative value', () => {
    expect(() => parseNutrition('{"kcal":-5}')).toThrow()
  })
})
