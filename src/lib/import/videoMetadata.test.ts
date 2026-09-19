import { describe, it, expect, vi } from 'vitest'
import { fetchVideoMetadata } from './videoMetadata'

function page(description: string, title = 'A video'): string {
  return `<!doctype html><html><head>
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
  </head><body></body></html>`
}

describe('fetchVideoMetadata', () => {
  it('prefers the oEmbed title and pairs it with the page description', async () => {
    const fetchText = vi.fn(async (url: string) =>
      url.includes('oembed')
        ? JSON.stringify({ title: 'Cacio e Pepe', author_name: 'Nonna' })
        : page('500g spaghetti, 100g pecorino, black pepper.'),
    )

    const meta = await fetchVideoMetadata(
      'https://www.youtube.com/watch?v=abc',
      'youtube',
      { fetchText },
    )

    expect(meta).toEqual({
      title: 'Cacio e Pepe',
      author: 'Nonna',
      caption: '500g spaghetti, 100g pecorino, black pepper.',
    })
  })

  it('falls back to the OpenGraph title when oEmbed fails', async () => {
    const fetchText = vi.fn(async (url: string) => {
      if (url.includes('oembed')) throw new Error('HTTP 401')
      return page('A caption', 'OG Title')
    })

    const meta = await fetchVideoMetadata('https://www.tiktok.com/@a/video/1', 'tiktok', {
      fetchText,
    })

    expect(meta.title).toBe('OG Title')
    expect(meta.caption).toBe('A caption')
  })

  // A metadata failure must never be fatal: the ladder's whole design is that
  // it escalates to the video when the caption comes up short or missing.
  it('returns an empty caption rather than throwing when everything fails', async () => {
    const fetchText = vi.fn(async () => {
      throw new Error('network down')
    })

    const meta = await fetchVideoMetadata('https://www.instagram.com/reel/x/', 'instagram', {
      fetchText,
    })

    expect(meta).toEqual({ title: null, author: null, caption: '' })
  })

  it('reads an oEmbed caption when the platform puts the text there', async () => {
    const fetchText = vi.fn(async (url: string) =>
      url.includes('oembed')
        ? JSON.stringify({ title: 'Carbonara #pasta', author_name: 'chef' })
        : page(''),
    )

    const meta = await fetchVideoMetadata('https://www.instagram.com/reel/x/', 'instagram', {
      fetchText,
    })

    // Instagram's oEmbed title IS the caption, so it must not be dropped just
    // because the page carried no description.
    expect(meta.caption).toBe('Carbonara #pasta')
  })

  it('decodes html entities in a description', async () => {
    const fetchText = vi.fn(async (url: string) =>
      url.includes('oembed') ? '{}' : page('Salt &amp; pepper &quot;to taste&quot;'),
    )

    const meta = await fetchVideoMetadata('https://youtu.be/abc', 'youtube', { fetchText })

    expect(meta.caption).toBe('Salt & pepper "to taste"')
  })

  it('ignores an oEmbed body that is not json', async () => {
    const fetchText = vi.fn(async (url: string) =>
      url.includes('oembed') ? '<html>rate limited</html>' : page('the caption'),
    )

    const meta = await fetchVideoMetadata('https://youtu.be/abc', 'youtube', { fetchText })

    expect(meta.caption).toBe('the caption')
  })
})
