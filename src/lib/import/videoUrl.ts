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
  const host = url.hostname.toLowerCase()

  // A short link's path is an opaque redirect token rather than a video id. It
  // is still the only handle we have, and yt-dlp resolves it either way.
  //
  // Three shapes carry one, and the share sheet hands out all three: the vm.
  // and vt. hosts, and a /t/ path on the main host -- which is what the mobile
  // app's "Copy link" produces, so it is the form a user is most likely to
  // paste. Missing it read the redirect stub as an ordinary page, which has no
  // recipe in it, and the import silently came back empty.
  if (hostIs(host, 'vm.tiktok.com') || hostIs(host, 'vt.tiktok.com')) {
    return url.pathname.slice(1).split('/')[0] || null
  }
  const short = /^\/t\/([^/]+)/.exec(url.pathname)
  if (short) return short[1]

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
