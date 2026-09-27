import { z } from 'zod'
import { NutrientsSchema, type Nutrients } from '@/lib/nutrition/types'

/**
 * Prompts and response parsing for the nutrition methods. Both providers send
 * a system prompt and a JSON user message and get JSON back, so everything
 * but the transport lives here and is tested once.
 *
 * Every response is an object rather than a bare array: OpenAI's json_object
 * mode refuses to return a top-level array, and one shape for both providers
 * keeps the parsers shared.
 */

export interface FoodMatchItem {
  name: string
  candidates: { fdcId: number; description: string }[]
}

export interface UnitWeightItem {
  name: string
  /** Canonical unit, or null for a bare count ("2 onions"). */
  unit: string | null
}

export const MATCH_FOODS_PROMPT = `You match recipe ingredients to USDA food database entries.
The input is a JSON array. Each item has an ingredient "name" and "candidates",
each with an "fdcId" and a USDA "description".
Return ONLY valid JSON: {"matches":[number|null]}, one entry per input item, in order.

Rules:
- Pick the candidate that is the same food as the ingredient, in its usual
  raw or as-sold form unless the name says otherwise ("cooked rice").
- Prefer the plain form: "butter" is salted butter, not butter oil.
- Use null when no candidate is the same food. A near miss ("onion" and
  "onion rings") is null. A wrong match is worse than none.
- Only return an fdcId that appears in that item's candidates.`

export const ESTIMATE_UNIT_WEIGHTS_PROMPT = `You estimate the weight of kitchen measures of ingredients.
The input is a JSON array of {"name":string,"unit":string|null}. A null unit
means one whole item, as in "2 onions" or "3 eggs".
Return ONLY valid JSON: {"grams":[number|null]}, one entry per input item, in order:
the grams in ONE of that unit of that ingredient.

Rules:
- Assume a typical medium item for a whole one.
- For a volume, use the ingredient as it is usually measured (flour spooned
  and levelled, herbs loosely packed).
- Use null when the measure makes no sense for the ingredient or you do not know.`

export const ESTIMATE_NUTRITION_PROMPT = `You estimate the nutrition of a food per 100 g.
Return ONLY valid JSON:
{"kcal":number|null,"protein":number|null,"carbs":number|null,"fat":number|null,
 "fiber":number|null,"sugar":number|null,"sodium":number|null}

Rules:
- Values are per 100 g of the food as usually sold. Protein, carbs, fat,
  fiber and sugar are grams; sodium is milligrams; kcal is kilocalories.
- Use typical reference values. Use null for any value you do not know.`

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
}

/** Reads `{[key]: [...]}`, or a bare array from a model that ignored the wrapper. */
function readList(raw: string, key: string, length: number): unknown[] {
  const payload = JSON.parse(stripFences(raw))
  const list = Array.isArray(payload) ? payload : payload?.[key]
  if (!Array.isArray(list) || list.length !== length) {
    // A short or long list cannot be lined up with the items, so none of it
    // is trusted; the resolver falls back to its no-LLM path.
    throw new Error(`Expected ${length} ${key}, got ${Array.isArray(list) ? list.length : 'none'}.`)
  }
  return list
}

export function matchFoodsMessage(items: FoodMatchItem[]): string {
  return JSON.stringify(items)
}

export function parseMatchFoods(raw: string, items: FoodMatchItem[]): (number | null)[] {
  const list = z.array(z.number().nullable()).parse(readList(raw, 'matches', items.length))
  // An ID the model invented, or took from another item, is treated as no match.
  return list.map((fdcId, i) =>
    fdcId !== null && items[i].candidates.some((c) => c.fdcId === fdcId) ? fdcId : null,
  )
}

export function unitWeightsMessage(items: UnitWeightItem[]): string {
  return JSON.stringify(items)
}

export function parseUnitWeights(raw: string, items: UnitWeightItem[]): (number | null)[] {
  const list = z.array(z.number().nullable()).parse(readList(raw, 'grams', items.length))
  return list.map((grams) => (grams !== null && Number.isFinite(grams) && grams > 0 ? grams : null))
}

export function parseNutrition(raw: string): Nutrients {
  return NutrientsSchema.parse(JSON.parse(stripFences(raw)))
}
