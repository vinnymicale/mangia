import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Formats minutes as "1h 20m", "45m", or an em dash when unknown. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

/** Renders a quantity without trailing zeros: 1.5 -> "1.5", 3.0 -> "3". */
export function formatQuantity(quantity: number | null): string {
  if (quantity === null) return ''
  return Number.isInteger(quantity)
    ? String(quantity)
    : String(Number(quantity.toFixed(2)))
}

/**
 * Returns the URL only if it is safe to put in an href. Recipe source URLs are
 * user-supplied, so a `javascript:` or `data:` value would otherwise execute on
 * click. Anything not http(s) yields null and should not be rendered as a link.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null
  } catch {
    // Relative or malformed values are never valid external sources.
    return null
  }
}
