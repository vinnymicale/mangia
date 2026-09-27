import { z } from 'zod'
import type { ParsedIngredient } from '@/lib/parsing/types'
import { NutrientsSchema, type Nutrients } from '@/lib/nutrition/types'
import type { FoodMatchItem, UnitWeightItem } from './nutrition'

export const DraftIngredientSchema = z.object({
  quantity: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
  ingredient: z.string(),
  note: z.string().nullable().default(null),
})

export const RecipeDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  instructions: z.string().default(''),
  servings: z.number().int().positive().nullable().default(null),
  prepMinutes: z.number().int().nonnegative().nullable().default(null),
  cookMinutes: z.number().int().nonnegative().nullable().default(null),
  ingredients: z.array(DraftIngredientSchema).default([]),
  tags: z.array(z.string()).default([]),
  /**
   * Per-serving values the source page printed, when it did. Only the web
   * importer fills this; it becomes the recipe's override, not an estimate.
   */
  nutrition: NutrientsSchema.nullable().optional(),
})

export type RecipeDraft = z.infer<typeof RecipeDraftSchema>

/**
 * A video to read, either as a URL the model fetches itself or as bytes.
 *
 * Both shapes exist because only YouTube can be handed over as a URL: Gemini
 * ingests one natively, while an Instagram or TikTok video has to be pulled
 * down first and passed inline.
 */
export type VideoSource =
  | { kind: 'url'; url: string }
  | { kind: 'bytes'; data: Buffer; mimeType: string }

export interface LlmProvider {
  readonly name: string
  /** Extracts a structured recipe from freeform page or note text. */
  extractRecipe(text: string): Promise<RecipeDraft>
  /** Structures ingredient lines the deterministic parser could not handle. */
  parseIngredientLines(lines: string[]): Promise<ParsedIngredient[]>
  /**
   * Extracts a structured recipe from a photo, typically a handwritten card.
   *
   * Throws when the configured model cannot see images. That is expected rather
   * than exceptional -- the photo import path catches it and falls back to OCR.
   */
  extractRecipeFromImage(image: Buffer, mimeType: string): Promise<RecipeDraft>
  /**
   * Extracts a structured recipe from a cooking video.
   *
   * Throws when the configured model cannot watch video, which is most of
   * them. Like the image method, that is expected rather than exceptional --
   * the video import path catches it and falls back to whatever the caption
   * gave it.
   */
  extractRecipeFromVideo(source: VideoSource): Promise<RecipeDraft>
  /**
   * Picks, for each ingredient, the USDA candidate that is the same food, or
   * null. One call covers a whole recipe. The result lines up with `items`.
   */
  matchFoods(items: FoodMatchItem[]): Promise<(number | null)[]>
  /** Grams in one of each unit ("cup" of flour, a bare-count onion), or null. */
  estimateUnitWeights(items: UnitWeightItem[]): Promise<(number | null)[]>
  /** A per-100 g estimate to pre-fill the manual form; never stored unsaved. */
  estimateNutrition(name: string): Promise<Nutrients>
}

export const EXTRACT_RECIPE_PROMPT = `You extract structured recipes from text.
Return ONLY valid JSON matching this shape:
{"title":string,"description":string|null,"instructions":string,
 "servings":number|null,"prepMinutes":number|null,"cookMinutes":number|null,
 "ingredients":[{"quantity":number|null,"unit":string|null,"ingredient":string,"note":string|null}],
 "tags":string[]}

Rules:
- "instructions" is markdown, one numbered step per line.
- "ingredient" is the food itself, without quantity, unit, or preparation.
- "note" holds preparation ("minced", "divided", "room temperature").
- Use null, never a guess, when a value is absent.
- Convert fractions to decimals (1/2 becomes 0.5).
- For a range, use the lower bound.`

export const EXTRACT_RECIPE_FROM_IMAGE_PROMPT = `You transcribe recipes from photographs, usually handwritten cards.
Return ONLY valid JSON matching this shape:
{"title":string,"description":string|null,"instructions":string,
 "servings":number|null,"prepMinutes":number|null,"cookMinutes":number|null,
 "ingredients":[{"quantity":number|null,"unit":string|null,"ingredient":string,"note":string|null}],
 "tags":string[]}

Rules:
- Transcribe what is written. Do not normalise wording, correct a recipe you
  think is wrong, or add a step the card does not have.
- When handwriting is illegible, use null rather than guessing. A missing
  quantity is recoverable; a wrong one is not.
- Keep the card's own words for "ingredient" and "note".
- "instructions" is markdown, one numbered step per line.
- "ingredient" is the food itself, without quantity, unit, or preparation.
- "note" holds preparation ("minced", "divided", "room temperature").
- Convert fractions to decimals (1/2 becomes 0.5).
- For a range, use the lower bound.`

export const EXTRACT_RECIPE_FROM_VIDEO_PROMPT = `You extract recipes from cooking videos.
Return ONLY valid JSON matching this shape:
{"title":string,"description":string|null,"instructions":string,
 "servings":number|null,"prepMinutes":number|null,"cookMinutes":number|null,
 "ingredients":[{"quantity":number|null,"unit":string|null,"ingredient":string,"note":string|null}],
 "tags":string[]}

Rules:
- Use what is said and what is shown, including on-screen text and any
  ingredient list the video displays.
- Ignore the intro, the sign-off, sponsor reads, and anything about a
  different dish.
- Cooks often say "a splash", "a good glug", or nothing at all. Use null for
  that quantity. Never invent a number to fill the field.
- Give every step the video performs, in order, even one mentioned only in
  passing.
- "instructions" is markdown, one numbered step per line.
- "ingredient" is the food itself, without quantity, unit, or preparation.
- "note" holds preparation ("minced", "divided", "room temperature").
- Convert fractions to decimals (1/2 becomes 0.5).
- For a range, use the lower bound.`

export const PARSE_LINES_PROMPT =`You structure recipe ingredient lines.
Return ONLY a JSON array, one object per input line, in the same order:
[{"quantity":number|null,"unit":string|null,"ingredient":string,"note":string|null}]

Rules:
- "ingredient" is the food itself, without quantity, unit, or preparation.
- "note" holds preparation or descriptive text.
- Use null, never a guess, when a value is absent.
- Convert fractions to decimals. For a range, use the lower bound.`
