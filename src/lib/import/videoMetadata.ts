import * as cheerio from 'cheerio'
import { guardedFetch } from './fetchGuard'
import type { VideoPlatform } from './videoUrl'

export interface VideoMetadata {
  title: string | null
  caption: string
  author: string | null
}

export interface VideoMetadataDeps {
  fetchText?: (url: string) => Promise<string>
}

const EMPTY: VideoMetadata = { title: null, caption: '', author: null }

/**
 * The public oEmbed endpoints. None needs a key, and all three return the
 * caption or title without an authenticated session.
 */
function oembedUrl(url: string, platform: VideoPlatform): string {
  const target = encodeURIComponent(url)
  switch (platform) {
    case 'youtube':
      return `https://www.youtube.com/oembed?format=json&url=${target}`
    case 'instagram':
      return `https://www.instagram.com/api/v1/oembed/?url=${target}`
    case 'tiktok':
      return `https://www.tiktok.com/oembed?url=${target}`
  }
}

async function defaultFetchText(url: string): Promise<string> {
  const response = await guardedFetch(url, {
    accept: 'application/json,text/html;q=0.9',
  })
  return response.text()
}

/** Pulls the OpenGraph title and description out of a watch/post page. */
function readOpenGraph(html: string): { title: string | null; description: string } {
  const $ = cheerio.load(html)
  const pick = (property: string) =>
    $(`meta[property="${property}"]`).attr('content') ??
    $(`meta[name="${property}"]`).attr('content') ??
    null
  return {
    title: pick('og:title'),
    description: pick('og:description') ?? pick('description') ?? '',
  }
}

/**
 * Gathers whatever text a platform publishes alongside a video.
 *
 * Two sources, because neither is reliable alone: oEmbed gives a clean title
 * and author but usually not the body, while the page's OpenGraph description
 * carries the caption. On Instagram the oEmbed title IS the caption, so it is
 * kept as a fallback for the caption too.
 *
 * Never throws. Every failure here is ordinary -- a rate limit, a login wall,
 * a changed endpoint -- and the ladder above responds by escalating to the
 * video itself rather than by reporting an error.
 */
export async function fetchVideoMetadata(
  url: string,
  platform: VideoPlatform,
  deps: VideoMetadataDeps = {},
): Promise<VideoMetadata> {
  const fetchText = deps.fetchText ?? defaultFetchText

  const [oembed, pageHtml] = await Promise.all([
    fetchText(oembedUrl(url, platform)).catch(() => null),
    fetchText(url).catch(() => null),
  ])

  let oembedTitle: string | null = null
  let author: string | null = null
  if (oembed !== null) {
    try {
      const body = JSON.parse(oembed)
      oembedTitle = typeof body.title === 'string' ? body.title : null
      author = typeof body.author_name === 'string' ? body.author_name : null
    } catch {
      // A non-JSON body means the endpoint refused us. The page may still work.
    }
  }

  const og = pageHtml === null ? { title: null, description: '' } : readOpenGraph(pageHtml)

  const caption = og.description.trim() || (oembedTitle ?? '').trim()
  const title = oembedTitle ?? og.title

  if (title === null && caption === '' && author === null) return EMPTY
  return { title, caption, author }
}
