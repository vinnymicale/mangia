import { z } from 'zod'
import type { ParsedIngredient } from '@/lib/parsing/types'

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
})

export type RecipeDraft = z.infer<typeof RecipeDraftSchema>

export interface LlmProvider {
  readonly name: string
  /** Extracts a structured recipe from freeform page or note text. */
  extractRecipe(text: string): Promise<RecipeDraft>
  /** Structures ingredient lines the deterministic parser could not handle. */
  parseIngredientLines(lines: string[]): Promise<ParsedIngredient[]>
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

export const PARSE_LINES_PROMPT = `You structure recipe ingredient lines.
Return ONLY a JSON array, one object per input line, in the same order:
[{"quantity":number|null,"unit":string|null,"ingredient":string,"note":string|null}]

Rules:
- "ingredient" is the food itself, without quantity, unit, or preparation.
- "note" holds preparation or descriptive text.
- Use null, never a guess, when a value is absent.
- Convert fractions to decimals. For a range, use the lower bound.`
