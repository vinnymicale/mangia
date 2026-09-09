import { describe, it, expect } from 'vitest'
import { safeExternalUrl, toParagraphs } from './utils'

describe('safeExternalUrl', () => {
  it('passes through http and https urls', () => {
    expect(safeExternalUrl('https://example.com/stew')).toBe('https://example.com/stew')
    expect(safeExternalUrl('http://example.com')).toBe('http://example.com')
  })

  it('rejects script-bearing schemes', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
  })

  it('rejects empty, null, and malformed values', () => {
    expect(safeExternalUrl(null)).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
    expect(safeExternalUrl('/recipes/1')).toBeNull()
  })
})

describe('toParagraphs', () => {
  it('splits on blank lines only', () => {
    expect(toParagraphs('One.\n\nTwo.')).toEqual(['One.', 'Two.'])
  })

  it('keeps a wrapped single paragraph intact', () => {
    // toSteps would split this into two; notes are prose, not a sequence.
    expect(toParagraphs('A long note\nthat wraps.')).toEqual([
      'A long note\nthat wraps.',
    ])
  })

  it('drops empty blocks', () => {
    expect(toParagraphs('\n\n  \n\nOnly.\n\n')).toEqual(['Only.'])
  })
})
