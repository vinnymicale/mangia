import { getRecipe } from '@/lib/db/recipes'
import {
  getNutritionData,
  getOverride,
  upsertIngredientNutrition,
  upsertUnitWeight,
  type UnitWeight,
} from '@/lib/db/nutrition'
import type { LlmProvider } from '@/lib/llm/types'
import type { FoodMatchItem, UnitWeightItem } from '@/lib/llm/nutrition'
import {
  canonicalUnit,
  computeRecipeNutrition,
  isWeightUnit,
  lookupWeight,
  ML_PER_UNIT,
  type ComputeInput,
  type RecipeNutrition,
} from './compute'
import {
  getFoods,
  searchFoods,
  UsdaUnavailableError,
  type UsdaFood,
  type UsdaOptions,
  type UsdaSearchResult,
} from './usda'
import { EMPTY_NUTRIENTS, validateNutrientsPer100g, validateUnitWeight } from './types'

/**
 * Fills in what a recipe's estimate is missing: per-100 g nutrition for each
 * ingredient never looked up, then the grams in each unit the recipe measures
 * it by. Everything found is stored per ingredient, so the next recipe using
 * "onion" costs nothing.
 *
 * Nothing here guesses silently. What cannot be found is stored as
 * `unmatched`, which the page shows as needing the cook's input; only
 * `retryUnmatched` looks at those again.
 */

export interface ResolveOptions {
  retryUnmatched: boolean
  usda: UsdaOptions
  /** Null when no AI provider is configured; the resolver then works without one. */
  provider: LlmProvider | null
}

export interface ResolvedNutrition extends RecipeNutrition {
  /** USDA could not be reached, so some lines are still pending. */
  usdaUnavailable: boolean
}

type Recipe = NonNullable<Awaited<ReturnType<typeof getRecipe>>>

function toComputeInput(recipe: Recipe): ComputeInput {
  return {
    servings: recipe.servings,
    lines: recipe.ingredients.map((ri) => ({
      recipeIngredientId: ri.id,
      ingredientId: ri.ingredientId,
      name: ri.ingredient.name,
      quantity: ri.quantity,
      unit: ri.unit,
    })),
  }
}

async function compute(input: ComputeInput, recipeId: string): Promise<RecipeNutrition> {
  const [{ nutrition, weights }, override] = await Promise.all([
    getNutritionData(input.lines.map((line) => line.ingredientId)),
    getOverride(recipeId),
  ])
  return computeRecipeNutrition(input, nutrition, weights, override)
}

/** The estimate from what is stored, touching no network. Null for an unknown recipe. */
export async function getRecipeNutrition(recipeId: string): Promise<RecipeNutrition | null> {
  const recipe = await getRecipe(recipeId)
  return recipe ? compute(toComputeInput(recipe), recipeId) : null
}

export async function resolveRecipeNutrition(
  recipeId: string,
  options: ResolveOptions,
): Promise<ResolvedNutrition | null> {
  const recipe = await getRecipe(recipeId)
  if (!recipe) return null
  const input = toComputeInput(recipe)
  const lines = input.lines.filter((line) => line.quantity !== null && line.quantity > 0)

  let usdaUnavailable = false
  try {
    const fetched = await resolveNutrition(lines, options)
    await resolveWeights(lines, fetched, options)
  } catch (error) {
    // Anything already stored stays; what is left is still pending and the
    // next load tries again.
    if (!(error instanceof UsdaUnavailableError)) throw error
    usdaUnavailable = true
  }

  return { ...(await compute(input, recipeId)), usdaUnavailable }
}

type Line = ComputeInput['lines'][number]

/** Step 1. Returns the USDA foods fetched, so step 2 can use their portions. */
async function resolveNutrition(lines: Line[], options: ResolveOptions): Promise<Map<number, UsdaFood>> {
  const { nutrition } = await getNutritionData(lines.map((line) => line.ingredientId))
  const targets = new Map<string, string>()
  for (const line of lines) {
    const row = nutrition.get(line.ingredientId)
    if (!row || (options.retryUnmatched && row.source === 'unmatched')) {
      targets.set(line.ingredientId, line.name)
    }
  }
  if (targets.size === 0) return new Map()

  // One at a time: DEMO_KEY allows 30 requests an hour, and a burst of
  // parallel searches would spend them all on one recipe.
  const searched: { ingredientId: string; name: string; candidates: UsdaSearchResult[] }[] = []
  for (const [ingredientId, name] of targets) {
    searched.push({ ingredientId, name, candidates: await searchFoods(name, options.usda) })
  }

  const matches = await chooseMatches(searched, options.provider)
  const ids = [...new Set(matches.filter((id): id is number => id !== null))]
  const foods = new Map((await getFoods(ids, options.usda)).map((food) => [food.fdcId, food]))

  for (const [i, target] of searched.entries()) {
    const food = matches[i] === null ? undefined : foods.get(matches[i]!)
    if (food && validateNutrientsPer100g(food.nutrients)) {
      await upsertIngredientNutrition(target.ingredientId, {
        ...food.nutrients, source: 'usda', fdcId: food.fdcId, fdcDescription: food.description,
      })
    } else {
      await upsertIngredientNutrition(target.ingredientId, {
        ...EMPTY_NUTRIENTS, source: 'unmatched', fdcId: null, fdcDescription: null,
      })
    }
  }
  return foods
}

async function chooseMatches(
  searched: { name: string; candidates: UsdaSearchResult[] }[],
  provider: LlmProvider | null,
): Promise<(number | null)[]> {
  const withCandidates = searched.filter((s) => s.candidates.length > 0)
  if (provider && withCandidates.length > 0) {
    const items: FoodMatchItem[] = withCandidates.map((s) => ({
      name: s.name,
      candidates: s.candidates.map(({ fdcId, description }) => ({ fdcId, description })),
    }))
    try {
      const chosen = await provider.matchFoods(items)
      return searched.map((s) => {
        const index = withCandidates.indexOf(s)
        return index === -1 ? null : chosen[index]
      })
    } catch {
      // Fall through to the conservative match below.
    }
  }
  return searched.map((s) => conservativeMatch(s.name, s.candidates))
}

/**
 * Without a model, only the obvious case is trusted: the top result's leading
 * term is the ingredient itself ("Onions, raw" for "onion"). Anything looser
 * would match "onion" to "Onion rings" and be worse than no answer.
 */
export function conservativeMatch(name: string, candidates: UsdaSearchResult[]): number | null {
  const top = candidates[0]
  if (!top) return null
  const lead = top.description.split(',')[0]
  return singularise(lead) === singularise(name) ? top.fdcId : null
}

export function singularise(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 3 || word.endsWith('ss')) return word
      if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
      if (/(oes|ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2)
      if (word.endsWith('s')) return word.slice(0, -1)
      return word
    })
    .join(' ')
}

/** Step 2: grams per unit, from USDA portions, then the model, else unmatched. */
async function resolveWeights(
  lines: Line[],
  fetched: Map<number, UsdaFood>,
  options: ResolveOptions,
): Promise<void> {
  const { nutrition, weights } = await getNutritionData(lines.map((line) => line.ingredientId))

  const targets: { ingredientId: string; name: string; unit: string | null }[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const unit = canonicalUnit(line.unit)
    const key = `${line.ingredientId}\u0000${unit ?? ''}`
    if (isWeightUnit(unit) || seen.has(key)) continue
    seen.add(key)
    // An ingredient the cook marked as not counted needs no weight.
    if (nutrition.get(line.ingredientId)?.source === 'none') continue
    const kind = lookupWeight(unit, weights.get(line.ingredientId) ?? []).kind
    if (kind === 'missing' || (options.retryUnmatched && kind === 'unmatched')) {
      targets.push({ ingredientId: line.ingredientId, name: line.name, unit })
    }
  }
  if (targets.length === 0) return

  // Portions for ingredients matched on an earlier load are fetched now.
  const needed = new Set<number>()
  for (const target of targets) {
    const fdcId = nutrition.get(target.ingredientId)?.fdcId
    if (fdcId != null && !fetched.has(fdcId)) needed.add(fdcId)
  }
  const foods = new Map(fetched)
  for (const food of await getFoods([...needed], options.usda)) foods.set(food.fdcId, food)

  const stored = new Map<string, UnitWeight[]>()
  const remaining: typeof targets = []
  for (const target of targets) {
    const fdcId = nutrition.get(target.ingredientId)?.fdcId
    const portions = fdcId == null ? [] : foods.get(fdcId)?.portions ?? []
    const isVolume = target.unit !== null && target.unit in ML_PER_UNIT
    // A volume portion answers any volume, since compute scales by density.
    const portion = portions.find((p) => p.unit === target.unit)
      ?? (isVolume ? portions.find((p) => p.unit !== null && p.unit in ML_PER_UNIT) : undefined)
    const already = stored.get(target.ingredientId) ?? []
    if (portion) {
      if (!already.some((w) => w.unit === portion.unit)) {
        await upsertUnitWeight(target.ingredientId, portion.unit, portion.grams, 'usda')
        already.push({ unit: portion.unit, grams: portion.grams, source: 'usda' })
        stored.set(target.ingredientId, already)
      }
    } else if (lookupWeight(target.unit, already).kind !== 'grams') {
      remaining.push(target)
    }
  }
  if (remaining.length === 0) return

  let estimates: (number | null)[] = remaining.map(() => null)
  if (options.provider) {
    const items: UnitWeightItem[] = remaining.map(({ name, unit }) => ({ name, unit }))
    try {
      estimates = await options.provider.estimateUnitWeights(items)
    } catch {
      // Left unmatched for the cook to fill in or retry.
    }
  }
  for (const [i, target] of remaining.entries()) {
    const grams = estimates[i]
    if (grams != null && validateUnitWeight(grams)) {
      await upsertUnitWeight(target.ingredientId, target.unit, grams, 'ai')
    } else {
      await upsertUnitWeight(target.ingredientId, target.unit, null, 'unmatched')
    }
  }
}
