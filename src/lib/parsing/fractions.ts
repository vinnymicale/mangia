const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375,
  '⅝': 0.625, '⅞': 0.875,
}

const UNICODE_FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('')

/** Matches a leading quantity: number, fraction, mixed, or range. */
export const QUANTITY_PATTERN = new RegExp(
  `^\\s*(\\d+(?:\\.\\d+)?(?:\\s*[-–—]\\s*|\\s+to\\s+)?\\d*(?:\\.\\d+)?(?:\\s*\\d+\\/\\d+)?[${UNICODE_FRACTION_CHARS}]?` +
    `|\\d*\\s*\\d+\\/\\d+` +
    `|[${UNICODE_FRACTION_CHARS}])`,
)

/**
 * Parses a quantity token into a number.
 * Ranges resolve to their lower bound ("2-3" -> 2).
 * Returns null when the token is not a quantity.
 */
export function parseQuantity(token: string): number | null {
  const raw = token.trim()
  if (raw === '') return null

  // Range: take the lower bound.
  const range = raw.match(/^(.+?)(?:\s*[-–—]\s*|\s+to\s+)(.+)$/)
  if (range) {
    const lower = parseQuantity(range[1])
    if (lower !== null) return lower
  }

  // Pure unicode fraction.
  if (raw.length === 1 && raw in UNICODE_FRACTIONS) {
    return UNICODE_FRACTIONS[raw]
  }

  // Mixed unicode: "1½" or "2 ¼"
  const mixedUnicode = raw.match(
    new RegExp(`^(\\d+)\\s*([${UNICODE_FRACTION_CHARS}])$`),
  )
  if (mixedUnicode) {
    return Number(mixedUnicode[1]) + UNICODE_FRACTIONS[mixedUnicode[2]]
  }

  // Mixed ascii: "1 1/2"
  const mixedAscii = raw.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixedAscii) {
    return Number(mixedAscii[1]) + Number(mixedAscii[2]) / Number(mixedAscii[3])
  }

  // Plain ascii fraction: "3/4"
  const fraction = raw.match(/^(\d+)\/(\d+)$/)
  if (fraction) {
    const denominator = Number(fraction[2])
    if (denominator === 0) return null
    return Number(fraction[1]) / denominator
  }

  // Plain number.
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw)

  return null
}
