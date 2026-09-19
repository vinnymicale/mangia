import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * True for addresses that are not routable on the public internet: loopback,
 * RFC1918 and carrier-grade NAT ranges, link-local (which covers the cloud
 * metadata endpoint at 169.254.169.254), and their IPv6 equivalents.
 */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    return false
  }
  if (version === 6) {
    const addr = ip.toLowerCase()
    if (addr === '::' || addr === '::1') return true
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd]/.test(addr) || /^fe[89ab]/.test(addr)) return true
    // IPv4-mapped, e.g. ::ffff:127.0.0.1
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr)
    if (mapped) return isPrivateAddress(mapped[1])
    return false
  }
  return false
}

/**
 * Resolves a hostname and rejects it if it points anywhere private. Import
 * URLs come from the user, so without this the server would happily fetch
 * LAN services and cloud metadata endpoints on their behalf.
 */
export async function assertPublicHost(parsed: URL): Promise<void> {
  const host = parsed.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new Error(`Refusing to fetch a private address: ${host}`)
    }
    return
  }
  let addresses: { address: string }[]
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    throw new Error(`Could not resolve host: ${host}`)
  }
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error(`Refusing to fetch a private address: ${host}`)
    }
  }
}

/** Rejects anything that is not a plain web URL, before a lookup is attempted. */
export function assertWebUrl(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Not a valid URL: ${url}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Only http and https URLs can be imported: ${url}`)
  }
  return parsed
}

const MAX_REDIRECTS = 5

/** Some sites serve a stub page to unknown clients. */
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (compatible; mangia/1.0; +https://github.com/mangia)'

/**
 * Fetches a URL with the private-address check applied to every hop.
 *
 * Redirects are followed by hand rather than by `fetch`, because a public URL
 * that 302s to 127.0.0.1 would otherwise slip straight past a check made only
 * on the URL the user typed.
 */
export async function guardedFetch(
  url: string,
  init: { accept?: string } = {},
): Promise<Response> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const parsed = assertWebUrl(current)
    await assertPublicHost(parsed)

    const response = await fetch(current, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: init.accept ?? 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error(`HTTP ${response.status} without a location`)
      current = new URL(location, current).toString()
      continue
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return response
  }
  throw new Error(`Too many redirects: ${url}`)
}
