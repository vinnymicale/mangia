import { parseQuantity } from './fractions'
import { normalizeUnit } from './units'
import type { ParsedIngredient } from './types'

const LEADING_NOTE_PATTERN = /^(zest|juice|peel|rind)\s+of\s+/i

/** Strips markdown/list bullets and surrounding whitespace. */
function stripBullet(line: string): string {
  return line.replace(/^\s*[-*•·]\s*/, '').trim()
}

/**
 * Pulls the first parenthetical out of a line.
 * Returns the line without it, plus the parenthetical contents.
 */
function extractParenthetical(line: string): {
  rest: string
  note: string | null
} {
  const match = line.match(/\(([^)]*)\)/)
  if (!match) return { rest: line, note: null }
  return {
    rest: (line.slice(0, match.index) + line.slice(match.index! + match[0].length))
      .replace(/\s{2,}/g, ' ')
      .trim(),
    note: match[1].trim() || null,
  }
}

/** Consumes a leading quantity token (number, fraction, mixed, or range). */
function takeQuantity(text: string): { quantity: number | null; rest: string } {
  const match = text.match(
    /^((?:\d+(?:\.\d+)?|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])(?:\s*(?:[-–—]|to)\s*(?:\d+(?:\.\d+)?|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]))?(?:\s+\d+\/\d+|\s*\d+\/\d+|\s*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])?|\d+\/\d+)\s+/,
  )
  if (!match) return { quantity: null, rest: text }
  const quantity = parseQuantity(match[1])
  if (quantity === null) return { quantity: null, rest: text }
  return { quantity, rest: text.slice(match[0].length).trim() }
}

/** Consumes a leading unit token when the next word is a known unit. */
function takeUnit(text: string): { unit: string | null; rest: string } {
  const match = text.match(/^(\S+)\s+(.*)$/)
  if (!match) return { unit: null, rest: text }
  const unit = normalizeUnit(match[1])
  if (unit === null) return { unit: null, rest: text }
  return { unit, rest: match[2].trim() }
}

/**
 * Parses one freeform ingredient line into structured fields.
 * Never throws, and never discards the original text.
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const rawText = line.trim()
  let working = stripBullet(rawText)

  const notes: string[] = []

  // "Zest of 1 lemon" -> note "zest", then parse "1 lemon" normally.
  const leadingNote = working.match(LEADING_NOTE_PATTERN)
  if (leadingNote) {
    notes.push(leadingNote[1].toLowerCase())
    working = working.slice(leadingNote[0].length).trim()
  }

  const paren = extractParenthetical(working)
  working = paren.rest
  if (paren.note) notes.push(paren.note)

  // A trailing comma clause is a preparation note ("garlic, minced").
  const commaIndex = working.indexOf(',')
  if (commaIndex !== -1) {
    const after = working.slice(commaIndex + 1).trim()
    if (after) notes.push(after)
    working = working.slice(0, commaIndex).trim()
  }

  const { quantity, rest: afterQuantity } = takeQuantity(working)
  const { unit, rest: afterUnit } =
    quantity === null ? { unit: null, rest: afterQuantity } : takeUnit(afterQuantity)

  const ingredient = afterUnit.trim()

  // A line with no quantity, or with nothing left after stripping, is
  // something the deterministic parser could not confidently structure.
  const confidence = quantity !== null && ingredient !== '' ? 'high' : 'low'

  return {
    quantity,
    unit,
    ingredient: ingredient === '' ? rawText : ingredient,
    note: notes.length > 0 ? notes.join(', ') : null,
    rawText,
    confidence,
  }
}

/** Parses a multi-line paste, skipping blank lines. */
export function parseIngredientBlob(text: string): ParsedIngredient[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map(parseIngredientLine)
}
