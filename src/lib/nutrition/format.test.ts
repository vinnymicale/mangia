import { describe, it, expect } from 'vitest'
import { formatNutrient, fromDraft, toDraft } from './format'
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
