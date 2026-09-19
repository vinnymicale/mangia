export type VideoPlatform = 'youtube' | 'instagram' | 'tiktok'

export type UrlKind =
  | { kind: 'article' }
  | { kind: 'video'; platform: VideoPlatform; id: string }

const ARTICLE: UrlKind = { kind: 'article' }

/** Matches a host exactly, or as a subdomain of it -- never as a suffix. */
function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function youtubeId(url: URL): string | null {
  if (hostIs(url.hostname, 'youtu.be')) {
    // youtu.be carries the id as the whole path.
    return url.pathname.slice(1).split('/')[0] || null
  }
  if (url.pathname === '/watch') return url.searchParams.get('v')
  const shorts = /^\/shorts\/([^/]+)/.exec(url.pathname)
  return shorts ? shorts[1] : null
}

function instagramId(url: URL): string | null {
  // p, reel, reels and tv are the four post shapes that can carry a video.
  const match = /^\/(?:p|reel|reels|tv)\/([^/]+)/.exec(url.pathname)
  return match ? match[1] : null
}

function tiktokId(url: URL): string | null {
  if (hostIs(url.hostname, 'vm.tiktok.com')) {
    // A short link's path is an opaque redirect token rather than a video id.
    // It is still the only handle we have, and yt-dlp resolves it either way.
    return url.pathname.slice(1).split('/')[0] || null
  }
  const match = /^\/@[^/]+\/video\/(\d+)/.exec(url.pathname)
  return match ? match[1] : null
}

/**
 * Decides whether a URL points at a video we can read or at an ordinary page.
 *
 * Anything unrecognised is an article. That keeps every URL that works today
 * working, and makes an unsupported video host degrade into a page read rather
 * than an error -- some of them publish the recipe in the page anyway.
 */
export function classifyUrl(url: string): UrlKind {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return ARTICLE
  }

  const host = parsed.hostname.toLowerCase()

  if (hostIs(host, 'youtube.com') || hostIs(host, 'youtu.be')) {
    const id = youtubeId(parsed)
    return id ? { kind: 'video', platform: 'youtube', id } : ARTICLE
  }

  if (hostIs(host, 'instagram.com')) {
    const id = instagramId(parsed)
    return id ? { kind: 'video', platform: 'instagram', id } : ARTICLE
  }

  if (hostIs(host, 'tiktok.com')) {
    const id = tiktokId(parsed)
    return id ? { kind: 'video', platform: 'tiktok', id } : ARTICLE
  }

  return ARTICLE
}
