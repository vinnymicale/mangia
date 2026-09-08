/** Canonical unit -> the aliases that map onto it. Case-insensitive except where noted. */
const UNIT_DEFINITIONS: Record<string, string[]> = {
  teaspoon: ['teaspoon', 'teaspoons', 'tsp', 'tsps', 'tsp.', 't'],
  tablespoon: ['tablespoon', 'tablespoons', 'tbsp', 'tbsps', 'tbsp.', 'tbs', 'T'],
  cup: ['cup', 'cups', 'c'],
  fluidOunce: ['fluid ounce', 'fluid ounces', 'fl oz', 'floz', 'fl. oz.'],
  pint: ['pint', 'pints', 'pt'],
  quart: ['quart', 'quarts', 'qt'],
  gallon: ['gallon', 'gallons', 'gal'],
  milliliter: ['milliliter', 'milliliters', 'millilitre', 'ml'],
  liter: ['liter', 'liters', 'litre', 'litres', 'l'],
  gram: ['gram', 'grams', 'g'],
  kilogram: ['kilogram', 'kilograms', 'kg'],
  ounce: ['ounce', 'ounces', 'oz'],
  pound: ['pound', 'pounds', 'lb', 'lbs'],
  clove: ['clove', 'cloves'],
  can: ['can', 'cans'],
  jar: ['jar', 'jars'],
  package: ['package', 'packages', 'pkg', 'pkgs'],
  bunch: ['bunch', 'bunches'],
  sprig: ['sprig', 'sprigs'],
  stalk: ['stalk', 'stalks'],
  slice: ['slice', 'slices'],
  pinch: ['pinch', 'pinches'],
  dash: ['dash', 'dashes'],
  handful: ['handful', 'handfuls'],
  piece: ['piece', 'pieces'],
  head: ['head', 'heads'],
  stick: ['stick', 'sticks'],
}

/**
 * Units that convert within a group, so their quantities may be summed
 * after conversion. Units absent from every group only sum against themselves.
 */
const COMPATIBILITY_GROUPS: string[][] = [
  ['teaspoon', 'tablespoon', 'cup', 'fluidOunce', 'pint', 'quart', 'gallon'],
  ['milliliter', 'liter'],
  ['gram', 'kilogram'],
  ['ounce', 'pound'],
]

/**
 * Size of one unit expressed in its group's base unit (teaspoon, milliliter,
 * gram, ounce). Only units inside a compatibility group need a factor;
 * everything else only ever sums against itself.
 */
export const UNIT_BASE_FACTORS: Record<string, number> = {
  teaspoon: 1,
  tablespoon: 3,
  fluidOunce: 6,
  cup: 48,
  pint: 96,
  quart: 192,
  gallon: 768,
  milliliter: 1,
  liter: 1000,
  gram: 1,
  kilogram: 1000,
  ounce: 1,
  pound: 16,
}

export const UNIT_ALIASES: Map<string, string> = (() => {
  const map = new Map<string, string>()
  for (const [canonical, aliases] of Object.entries(UNIT_DEFINITIONS)) {
    for (const alias of aliases) {
      // "T" (tablespoon) vs "t" (teaspoon) are the only case-sensitive aliases,
      // so single-character aliases are stored with their case preserved.
      const key = alias.length === 1 ? alias : alias.toLowerCase()
      map.set(key, canonical)
    }
  }
  return map
})()

/** Returns the canonical unit name, or null when the token is not a unit. */
export function normalizeUnit(raw: string): string | null {
  const trimmed = raw.trim().replace(/\.$/, '')
  if (trimmed === '') return null
  if (trimmed.length === 1 && UNIT_ALIASES.has(trimmed)) {
    return UNIT_ALIASES.get(trimmed)!
  }
  return UNIT_ALIASES.get(trimmed.toLowerCase()) ?? null
}

/** True when two quantities in these units may be summed into one line. */
export function areUnitsCompatible(a: string | null, b: string | null): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  if (a === b) return true
  return COMPATIBILITY_GROUPS.some(
    (group) => group.includes(a) && group.includes(b),
  )
}
