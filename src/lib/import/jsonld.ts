import * as cheerio from 'cheerio'
import { parseIngredientLine } from '@/lib/parsing/parseIngredient'
import type { RecipeDraft } from '@/lib/llm/types'

/** Converts an ISO 8601 duration such as PT2H30M to whole minutes. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^P(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?)?/.exec(value)
  if (!match) return null
  const days = Number(match[1] ?? 0)
  const hours = Number(match[2] ?? 0)
  const minutes = Number(match[3] ?? 0)
  const total = days * 1440 + hours * 60 + minutes
  return total > 0 ? Math.round(total) : null
}

/** recipeYield may be a number, "4", "4 servings", or an array of those. */
export function parseYield(value: unknown): number | null {
  const candidate = Array.isArray(value) ? value[0] : value
  if (typeof candidate === 'number') {
    return Number.isFinite(candidate) ? Math.round(candidate) : null
  }
  if (typeof candidate !== 'string') return null
  const match = /\d+/.exec(candidate)
  return match ? Number(match[0]) : null
}

/** Flattens HowToStep / HowToSection trees into numbered markdown lines. */
export function flattenInstructions(value: unknown): string {
  const steps: string[] = []

  const walk = (node: unknown): void => {
    if (node === null || node === undefined) return
    if (typeof node === 'string') {
      const text = node.trim()
      if (text !== '') steps.push(text)
      return
    }
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (typeof node === 'object') {
      const record = node as Record<string, unknown>
      if (record.itemListElement) {
        walk(record.itemListElement)
        return
      }
      walk(record.text ?? record.name)
    }
  }

  walk(value)

  // A single prose blob arrives as one "step"; keep it unnumbered.
  if (steps.length === 1) return steps[0]
  return steps.map((step, i) => `${i + 1}. ${step}`).join('\n')
}

function isRecipeNode(node: unknown): node is Record<string, unknown> {
  if (typeof node !== 'object' || node === null) return false
  const type = (node as Record<string, unknown>)['@type']
  if (type === 'Recipe') return true
  return Array.isArray(type) && type.includes('Recipe')
}

/** Depth-first search for a Recipe node inside arbitrary JSON-LD. */
function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (isRecipeNode(node)) return node
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRecipeNode(child)
      if (found) return found
    }
    return null
  }
  if (typeof node === 'object' && node !== null) {
    const graph = (node as Record<string, unknown>)['@graph']
    if (graph) return findRecipeNode(graph)
  }
  return null
}

function firstString(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' && candidate.trim() !== ''
    ? candidate.trim()
    : null
}

export function extractJsonLdRecipe(html: string): RecipeDraft | null {
  const $ = cheerio.load(html)
  const blocks = $('script[type="application/ld+json"]').toArray()

  for (const block of blocks) {
    let payload: unknown
    try {
      payload = JSON.parse($(block).text())
    } catch {
      continue // Malformed block; try the next one.
    }
    const recipe = findRecipeNode(payload)
    if (!recipe) continue

    const title = firstString(recipe.name)
    if (!title) continue

    const rawIngredients = Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient.filter(
          (line): line is string => typeof line === 'string',
        )
      : []

    return {
      title,
      description: firstString(recipe.description),
      instructions: flattenInstructions(recipe.recipeInstructions),
      servings: parseYield(recipe.recipeYield),
      prepMinutes: parseIsoDuration(recipe.prepTime),
      cookMinutes: parseIsoDuration(recipe.cookTime),
      ingredients: rawIngredients.map((line) => {
        const parsed = parseIngredientLine(line)
        return {
          quantity: parsed.quantity,
          unit: parsed.unit,
          ingredient: parsed.ingredient,
          note: parsed.note,
        }
      }),
      tags: [],
    }
  }

  return null
}
