import { describe, it, expect } from 'vitest'
import type { IngredientNutritionData, UnitWeight } from '@/lib/db/nutrition'
import { computeRecipeNutrition, lookupWeight, type ComputeLine } from './compute'
import { EMPTY_NUTRIENTS } from './types'

function nutrition(
  patch: Partial<IngredientNutritionData> = {},
): IngredientNutritionData {
  return { ...EMPTY_NUTRIENTS, source: 'usda', fdcId: 1, fdcDescription: 'Food, raw', ...patch }
}

function line(
  ingredientId: string,
  quantity: number | null,
  unit: string | null,
): ComputeLine {
  return { recipeIngredientId: `ri-${ingredientId}`, ingredientId, name: ingredientId, quantity, unit }
}

describe('lookupWeight', () => {
  it('converts weight units without a row', () => {
    expect(lookupWeight('pound', [])).toEqual({ kind: 'grams', gramsPerUnit: 453.592 })
  })

  it('scales a volume row across US and metric volumes', () => {
    const weights: UnitWeight[] = [{ unit: 'cup', grams: 120, source: 'usda' }]
    const tbsp = lookupWeight('tablespoon', weights)
    expect(tbsp.kind).toBe('grams')
    expect((tbsp as { gramsPerUnit: number }).gramsPerUnit).toBeCloseTo(7.5, 1)
    const ml = lookupWeight('milliliter', weights)
    expect((ml as { gramsPerUnit: number }).gramsPerUnit).toBeCloseTo(0.507, 2)
  })

  it('prefers any usable volume weight over an unmatched exact row', () => {
    const weights: UnitWeight[] = [
      { unit: 'teaspoon', grams: null, source: 'unmatched' },
      { unit: 'cup', grams: 240, source: 'manual' },
    ]
    expect(lookupWeight('teaspoon', weights).kind).toBe('grams')
  })

  it('does not scale a bare count or a non-volume unit from other rows', () => {
    const weights: UnitWeight[] = [{ unit: 'cup', grams: 160, source: 'usda' }]
    expect(lookupWeight(null, weights).kind).toBe('missing')
    expect(lookupWeight('clove', weights).kind).toBe('missing')
  })

  it('reports none and unmatched markers', () => {
    expect(lookupWeight(null, [{ unit: null, grams: null, source: 'none' }]).kind).toBe('blank')
    expect(lookupWeight('clove', [{ unit: 'clove', grams: null, source: 'unmatched' }]).kind)
      .toBe('unmatched')
  })
})

describe('computeRecipeNutrition', () => {
  const flour = nutrition({ kcal: 364, protein: 10, carbs: 76, fat: 1, sugar: null })
  const butter = nutrition({ kcal: 717, protein: 1, carbs: 0, fat: 81, sugar: 0 })

  it('sums counted lines and divides by servings', () => {
    const result = computeRecipeNutrition(
      { servings: 4, lines: [line('flour', 200, 'g'), line('butter', 2, 'tbsp')] },
      new Map([['flour', flour], ['butter', butter]]),
      new Map([['butter', [{ unit: 'tablespoon', grams: 14, source: 'usda' }]]]),
      null,
    )
    expect(result.source).toBe('estimate')
    expect(result.basis).toBe('serving')
    expect(result.counted).toBe(2)
    expect(result.countable).toBe(2)
    // (728 + 200.76) / 4
    expect(result.totals.kcal).toBeCloseTo(232.19, 1)
    // Sugar is known only for butter, so it sums over butter alone.
    expect(result.totals.sugar).toBe(0)
    expect(result.lines[1].grams).toBe(28)
  })

  it('reports per recipe when servings are unknown', () => {
    const result = computeRecipeNutrition(
      { servings: null, lines: [line('flour', 100, 'gram')] },
      new Map([['flour', flour]]), new Map(), null,
    )
    expect(result.basis).toBe('recipe')
    expect(result.totals.kcal).toBe(364)
  })

  it('assigns each status', () => {
    const result = computeRecipeNutrition(
      {
        servings: 2,
        lines: [
          line('salt', null, null),
          line('parsley', 1, 'bunch'),
          line('saffron', 1, 'g'),
          line('mystery', 100, 'g'),
          line('onion', 2, null),
          line('flour', 1, 'cup'),
        ],
      },
      new Map([
        ['parsley', nutrition({ source: 'none', fdcId: null, fdcDescription: null })],
        ['mystery', nutrition({ source: 'unmatched', fdcId: null, fdcDescription: null })],
        ['onion', nutrition({ kcal: 40 })],
        ['flour', flour],
      ]),
      new Map([['onion', [{ unit: null, grams: null, source: 'unmatched' }]]]),
      null,
    )
    expect(result.lines.map((l) => l.status)).toEqual([
      'noQuantity', 'blank', 'pending', 'needsNutrition', 'needsWeight', 'pending',
    ])
    expect(result.countable).toBe(4)
    expect(result.counted).toBe(0)
    expect(result.needsInput).toBe(2)
    expect(result.pending).toBe(true)
    expect(result.source).toBe('none')
    expect(result.totals).toEqual(EMPTY_NUTRIENTS)
  })

  it('normalises unit aliases before looking up weights', () => {
    const result = computeRecipeNutrition(
      { servings: 1, lines: [line('butter', 1, 'Tbsp')] },
      new Map([['butter', butter]]),
      new Map([['butter', [{ unit: 'tablespoon', grams: 14, source: 'usda' }]]]),
      null,
    )
    expect(result.lines[0].unit).toBe('tablespoon')
    expect(result.lines[0].status).toBe('counted')
  })

  it('lets the override win while still computing lines', () => {
    const result = computeRecipeNutrition(
      { servings: null, lines: [line('flour', 100, 'g')] },
      new Map([['flour', flour]]), new Map(),
      { ...EMPTY_NUTRIENTS, kcal: 500, note: 'From source page' },
    )
    expect(result.source).toBe('override')
    expect(result.basis).toBe('serving')
    expect(result.totals.kcal).toBe(500)
    expect(result.overrideNote).toBe('From source page')
    expect(result.lines[0].status).toBe('counted')
  })
})
