import { describe, it, expect } from 'vitest'
import { safeExternalUrl } from './utils'

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
