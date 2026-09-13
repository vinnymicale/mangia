import { describe, it, expect } from 'vitest'
import { downscale, toBase64 } from './photoDownscale'

describe('downscale', () => {
  it('hands back the original when the browser cannot decode it', async () => {
    // jsdom has no canvas, so this is the fallback path -- which is the one
    // that matters: an undecodable photo must still be uploadable.
    const file = new File([new Uint8Array([1, 2, 3])], 'card.png', { type: 'image/png' })

    const result = await downscale(file, 1600, 0.8)

    expect(result.mimeType).toBe('image/png')
    expect(await toBase64(result.blob)).toBe(Buffer.from([1, 2, 3]).toString('base64'))
  })
})

describe('toBase64', () => {
  it('encodes bytes without the data URI prefix', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0x00, 0x41])])

    expect(await toBase64(blob)).toBe(Buffer.from([0xff, 0xd8, 0x00, 0x41]).toString('base64'))
  })

  it('encodes a multi-megabyte photo, the size this feature exists to handle', async () => {
    const bytes = new Uint8Array(3_000_000).fill(0x61)
    const blob = new Blob([bytes])

    expect(await toBase64(blob)).toBe(Buffer.from(bytes).toString('base64'))
  })
})
