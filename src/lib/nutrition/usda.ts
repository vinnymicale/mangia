import { normalizeUnit } from '@/lib/parsing/units'
import { EMPTY_NUTRIENTS, type Nutrients } from './types'

/**
 * FoodData Central client. Only the Foundation and SR Legacy datasets are
 * searched: they describe generic ingredients per 100 g, whereas Branded foods
 * are per-product label data and would match "butter" to one company's spread.
 */

export const USDA_DATASETS = ['Foundation', 'SR Legacy'] as const

/** USDA's shared public key: 30 requests an hour, enough to try the feature. */
export const DEMO_KEY = 'DEMO_KEY'

export interface UsdaOptions {
  apiKey: string | null
  baseUrl: string
}

export interface UsdaSearchResult {
  fdcId: number
  description: string
  dataType: string
}

export interface UsdaPortion {
  /** Canonical unit, or null for a bare count ("1 medium onion"). */
  unit: string | null
  /** Grams in one of `unit`. */
  grams: number
  /** USDA's own wording, shown when the cook reviews a match. */
  label: string
}

export interface UsdaFood {
  fdcId: number
  description: string
  /** Per 100 g. */
  nutrients: Nutrients
  portions: UsdaPortion[]
}

/**
 * The service could not answer: offline, rate-limited or failing. Distinct
 * from "no match" so the resolver stops and leaves items un-attempted for the
 * next load to retry, instead of marking them unmatched for the cook.
 */
export class UsdaUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsdaUnavailableError'
  }
}

const TIMEOUT_MS = 10_000

async function request(path: string, body: unknown, options: UsdaOptions): Promise<unknown> {
  const url = new URL(`${options.baseUrl.replace(/\/$/, '')}${path}`)
  url.searchParams.set('api_key', options.apiKey || DEMO_KEY)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    throw new UsdaUnavailableError(
      `USDA FoodData Central is unreachable: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (response.status === 429) {
    throw new UsdaUnavailableError('USDA FoodData Central rate limit reached; try again later.')
  }
  if (response.status >= 500) {
    throw new UsdaUnavailableError(`USDA FoodData Central returned ${response.status}.`)
  }
  if (!response.ok) {
    // A 4xx other than 429 is a bad key or a bad request, which retrying will
    // not fix; surfacing it as a plain error lets the settings test show it.
    throw new Error(`USDA FoodData Central rejected the request (${response.status}).`)
  }
  return response.json()
}

interface RawSearchFood {
  fdcId?: unknown
  description?: unknown
  dataType?: unknown
}

export async function searchFoods(query: string, options: UsdaOptions): Promise<UsdaSearchResult[]> {
  const payload = (await request(
    '/v1/foods/search',
    { query, dataType: USDA_DATASETS, pageSize: 10 },
    options,
  )) as { foods?: RawSearchFood[] }
  return (payload.foods ?? [])
    .filter((food) => typeof food.fdcId === 'number' && typeof food.description === 'string')
    .map((food) => ({
      fdcId: food.fdcId as number,
      description: food.description as string,
      dataType: typeof food.dataType === 'string' ? food.dataType : '',
    }))
    .slice(0, 10)
}

interface RawFoodNutrient {
  // `format: full` nests the nutrient; the abridged format flattens it.
  nutrient?: { id?: number; number?: string }
  nutrientId?: number
  amount?: number
  value?: number
}

interface RawPortion {
  gramWeight?: number
  amount?: number
  modifier?: string
  portionDescription?: string
  measureUnit?: { name?: string; abbreviation?: string }
}

interface RawFood {
  fdcId?: number
  description?: string
  foodNutrients?: RawFoodNutrient[]
  foodPortions?: RawPortion[]
}

/**
 * Nutrient IDs in preference order. Foundation foods often omit plain energy
 * (1008) and carry only the Atwater figures, and sugar moves between the
 * "total including NLEA" (2000) and older "total" (1063) IDs by dataset.
 */
const NUTRIENT_IDS: Record<keyof Nutrients, number[]> = {
  kcal: [1008, 2047, 2048],
  protein: [1003],
  fat: [1004],
  carbs: [1005],
  fiber: [1079],
  sugar: [2000, 1063],
  sodium: [1093],
}

export function mapNutrients(foodNutrients: RawFoodNutrient[]): Nutrients {
  const byId = new Map<number, number>()
  for (const entry of foodNutrients) {
    const id = entry.nutrient?.id ?? entry.nutrientId
    const amount = entry.amount ?? entry.value
    if (typeof id === 'number' && typeof amount === 'number' && Number.isFinite(amount)) {
      byId.set(id, amount)
    }
  }
  const result: Nutrients = { ...EMPTY_NUTRIENTS }
  for (const [key, ids] of Object.entries(NUTRIENT_IDS) as [keyof Nutrients, number[]][]) {
    const id = ids.find((candidate) => byId.has(candidate))
    result[key] = id === undefined ? null : byId.get(id)!
  }
  return result
}

/** Size words that make a portion a bare count, most typical first. */
const COUNT_WORDS = ['medium', 'whole', 'each', 'large', 'small', 'extra large']

/**
 * Turns USDA's portion list into grams per canonical unit. SR Legacy puts the
 * measure in `modifier` ("cup, chopped", "tbsp", "large") under the measure
 * unit "undetermined"; Foundation fills `measureUnit` properly. Weight units
 * are dropped because they convert directly, and at most one bare-count
 * portion is kept, preferring "medium" so "2 onions" is not two large ones.
 */
export function mapPortions(portions: RawPortion[]): UsdaPortion[] {
  const byUnit = new Map<string, UsdaPortion>()
  let count: { rank: number; portion: UsdaPortion } | null = null

  for (const portion of portions) {
    const grams = portion.gramWeight
    const amount = portion.amount && portion.amount > 0 ? portion.amount : 1
    if (typeof grams !== 'number' || !(grams > 0)) continue
    const perUnit = grams / amount

    const measure = portion.measureUnit?.name?.trim().toLowerCase() ?? ''
    const text = measure && measure !== 'undetermined' ? measure : (portion.modifier ?? portion.portionDescription ?? '')
    // The unit is the leading phrase: "cup, chopped", "medium (2-1/2\" dia)".
    const head = text.toLowerCase().split(/[,(]/)[0].trim()
    const label = [measure !== 'undetermined' ? measure : '', portion.modifier ?? portion.portionDescription ?? '']
      .filter(Boolean).join(', ') || head

    const rank = COUNT_WORDS.indexOf(head)
    if (rank !== -1) {
      if (!count || rank < count.rank) count = { rank, portion: { unit: null, grams: perUnit, label } }
      continue
    }

    const unit = normalizeUnit(head) ?? normalizeUnit(head.split(/\s+/)[0] ?? '')
    if (!unit || ['gram', 'kilogram', 'ounce', 'pound'].includes(unit)) continue
    // The first portion listed for a unit is USDA's plainest ("cup" before
    // "cup, packed"), so later ones do not replace it.
    if (!byUnit.has(unit)) byUnit.set(unit, { unit, grams: perUnit, label })
  }

  const result = [...byUnit.values()]
  if (count) result.push(count.portion)
  return result
}

export async function getFoods(fdcIds: number[], options: UsdaOptions): Promise<UsdaFood[]> {
  if (fdcIds.length === 0) return []
  const payload = (await request('/v1/foods', { fdcIds, format: 'full' }, options)) as RawFood[]
  if (!Array.isArray(payload)) return []
  return payload
    .filter((food) => typeof food.fdcId === 'number')
    .map((food) => ({
      fdcId: food.fdcId!,
      description: food.description ?? '',
      nutrients: mapNutrients(food.foodNutrients ?? []),
      portions: mapPortions(food.foodPortions ?? []),
    }))
}
