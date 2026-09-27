import { describe, it, expect } from 'vitest'
import { formatNutrient, fromDraft, toDraft, formatMacroLine } from './format'
import { EMPTY_NUTRIENTS } from './types'

describe('formatNutrient', () => {
  it('rounds by magnitude and unit', () => {
    expect(formatNutrient('kcal', 639.6)).toBe('640 kcal')
    expect(formatNutrient('protein', 38.44)).toBe('38 g')
    expect(formatNutrient('fiber', 2.46)).toBe('2.5 g')
    expect(formatNutrient('sodium', 812.4)).toBe('812 mg')
    expect(formatNutrient('sugar', null)).toBe('—')
  })
})

describe('drafts', () => {
  it('round-trips values, with blank as null', () => {
    const n = { ...EMPTY_NUTRIENTS, kcal: 120, fat: 3.5 }
    expect(fromDraft(toDraft(n))).toEqual(n)
  })

  it('refuses text that is not a non-negative number', () => {
    expect(fromDraft({ ...toDraft(null), kcal: 'lots' })).toBeNull()
    expect(fromDraft({ ...toDraft(null), fat: '-1' })).toBeNull()
  })
})

describe('formatMacroLine', () => {
  const base = {
    basis: 'serving' as const, source: 'estimate' as const, overrideNote: null, lines: [],
    counted: 3, countable: 3, needsInput: 0, pending: false,
    totals: { kcal: 640.4, protein: 38.2, carbs: 52, fat: 27.6, fiber: 4, sugar: 6, sodium: 900 },
  }

  it('prints the four headline values of an estimate', () => {
    expect(formatMacroLine(base)).toBe('≈ 640 kcal · 38 g protein · 52 g carbs · 28 g fat per serving')
  })

  it('drops the ≈ for values the cook entered and skips missing ones', () => {
    expect(formatMacroLine({
      ...base, source: 'override', basis: 'recipe',
      totals: { ...base.totals, protein: null, carbs: null, fat: null },
    })).toBe('640 kcal for the whole recipe')
  })

  it('is null when there is nothing to print', () => {
    expect(formatMacroLine({ ...base, source: 'none' })).toBeNull()
    expect(formatMacroLine({
      ...base, totals: { ...base.totals, kcal: null, protein: null, carbs: null, fat: null },
    })).toBeNull()
  })
})
