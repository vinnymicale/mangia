import { describe, it, expect } from 'vitest'
import { EXTRACT_RECIPE_FROM_IMAGE_PROMPT } from './types'

describe('EXTRACT_RECIPE_FROM_IMAGE_PROMPT', () => {
  it('asks the model to transcribe rather than normalise', () => {
    expect(EXTRACT_RECIPE_FROM_IMAGE_PROMPT).toMatch(/transcribe/i)
  })

  it('prefers null over a guess when the writing is illegible', () => {
    expect(EXTRACT_RECIPE_FROM_IMAGE_PROMPT).toContain('null')
    expect(EXTRACT_RECIPE_FROM_IMAGE_PROMPT).toMatch(/illegible|unclear|cannot read/i)
  })

  it('names the same JSON keys the text extractor returns', () => {
    for (const key of ['title', 'ingredients', 'instructions', 'servings', 'tags']) {
      expect(EXTRACT_RECIPE_FROM_IMAGE_PROMPT).toContain(`"${key}"`)
    }
  })
})
