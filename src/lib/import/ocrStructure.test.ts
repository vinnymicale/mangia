import { describe, it, expect } from 'vitest'
import { structureOcrText } from './ocrStructure'

const CLEAN_CARD = `Nonna's Sunday Gravy
Serves 6
Prep 20 minutes
Cook 3 hours

Ingredients
2 tbsp olive oil
1 lb pork ribs
28 oz crushed tomatoes
salt to taste

Method
Brown the ribs in the oil over medium heat.
Add the tomatoes and simmer for three hours.
Season and serve over pasta.`

const HEADINGLESS = `Lemon Bars
1 cup flour
1/2 cup butter
2 eggs
Press the flour and butter into a pan and bake until it is a pale gold.
Whisk the eggs with the lemon and pour the mixture over the hot crust.`

describe('structureOcrText', () => {
  it('takes the first short line as the title', () => {
    expect(structureOcrText(CLEAN_CARD).title).toBe("Nonna's Sunday Gravy")
  })

  it('splits on ingredient and method headings', () => {
    const draft = structureOcrText(CLEAN_CARD)
    expect(draft.ingredients.map((i) => i.ingredient)).toEqual([
      'olive oil',
      'pork ribs',
      'crushed tomatoes',
      'salt to taste',
    ])
    expect(draft.instructions).toContain('Brown the ribs')
    expect(draft.instructions).toContain('Season and serve')
    // Headings are structure, not content: they must not survive into a step.
    expect(draft.instructions).not.toMatch(/^\s*\d+\.\s*Method/m)
  })

  it('numbers each instruction line', () => {
    expect(structureOcrText(CLEAN_CARD).instructions.split('\n')).toEqual([
      '1. Brown the ribs in the oil over medium heat.',
      '2. Add the tomatoes and simmer for three hours.',
      '3. Season and serve over pasta.',
    ])
  })

  it('reads servings and times off the card', () => {
    const draft = structureOcrText(CLEAN_CARD)
    expect(draft.servings).toBe(6)
    expect(draft.prepMinutes).toBe(20)
    expect(draft.cookMinutes).toBe(180)
  })

  it('falls back to shape when the card has no headings', () => {
    const draft = structureOcrText(HEADINGLESS)
    expect(draft.title).toBe('Lemon Bars')
    expect(draft.ingredients.map((i) => i.ingredient)).toEqual([
      'flour',
      'butter',
      'eggs',
    ])
    expect(draft.instructions).toContain('Press the flour and butter')
  })

  it('marks every row low confidence, because OCR output deserves a look', () => {
    for (const row of structureOcrText(CLEAN_CARD).ingredients) {
      expect(row.confidence).toBe('low')
    }
  })

  it('keeps unplaceable text in notes rather than dropping it', () => {
    const draft = structureOcrText('from the back of the Aunt Ida card, 1974')
    expect(draft.notes).toContain('1974')
  })

  it('survives garbled input without throwing', () => {
    const draft = structureOcrText('|||  ~~~ \n\n  ###')
    expect(draft.ingredients).toEqual([])
    expect(typeof draft.title).toBe('string')
  })

  it('returns an empty draft for empty text', () => {
    const draft = structureOcrText('   \n  \n')
    expect(draft.title).toBe('')
    expect(draft.ingredients).toEqual([])
    expect(draft.instructions).toBe('')
    expect(draft.notes).toBeNull()
  })
})
