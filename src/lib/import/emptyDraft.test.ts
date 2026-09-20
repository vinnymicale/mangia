import { describe, it, expect } from 'vitest'
import { isEmptyDraft } from './emptyDraft'

describe('isEmptyDraft', () => {
  it('keeps a draft that has ingredients but no method', () => {
    expect(
      isEmptyDraft({
        instructions: '',
        ingredients: [{ quantity: 1, unit: null, ingredient: 'egg', note: null }],
      }),
    ).toBe(false)
  })

  it('keeps a draft that has a method but no ingredients', () => {
    expect(isEmptyDraft({ instructions: '1. Boil pasta.', ingredients: [] })).toBe(false)
  })

  it('keeps an OCR draft whose text all landed in notes', () => {
    // The photo path parks whatever it could not place here rather than
    // discarding it, so this draft still has something the user can sort out.
    expect(
      isEmptyDraft({ instructions: '', ingredients: [], notes: 'flour sugar butter' }),
    ).toBe(false)
  })

  it('rejects a draft with neither ingredients nor a method', () => {
    expect(isEmptyDraft({ instructions: '', ingredients: [] })).toBe(true)
  })

  it('rejects a draft whose instructions are only whitespace', () => {
    expect(isEmptyDraft({ instructions: '  \n\t ', ingredients: [] })).toBe(true)
  })

  it('rejects a draft whose notes are only whitespace', () => {
    expect(isEmptyDraft({ instructions: '', ingredients: [], notes: '   ' })).toBe(true)
  })

  it('treats null notes as no notes', () => {
    expect(isEmptyDraft({ instructions: '', ingredients: [], notes: null })).toBe(true)
  })

  it('treats absent fields as empty ones', () => {
    // The structural type makes every field optional so one function serves
    // both draft shapes; an absent field must read the same as an empty one.
    expect(isEmptyDraft({})).toBe(true)
  })

  it('ignores a title, which every scraper produces whether or not it read a recipe', () => {
    expect(isEmptyDraft({ instructions: '', ingredients: [] })).toBe(true)
  })
})
