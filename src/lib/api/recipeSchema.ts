import { z } from 'zod'

/**
 * The request shape both recipe endpoints accept. POST and PUT take the same
 * body -- a recipe is replaced wholesale on edit -- so the schema lives here
 * rather than being copied into each route and drifting.
 */
export const IngredientSchema = z.object({
  quantity: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
  ingredient: z.string().min(1),
  note: z.string().nullable().default(null),
  rawText: z.string().default(''),
  // Carried through because RecipeInput requires it; the client may omit it.
  confidence: z.enum(['high', 'low']).default('high'),
})

export const AliasSchema = z.object({
  alias: z.string().min(1),
  canonical: z.string().min(1),
})

export const RecipeBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  instructions: z.string().default(''),
  notes: z.string().nullable().default(null),
  servings: z.number().int().positive().nullable().default(null),
  prepMinutes: z.number().int().nonnegative().nullable().default(null),
  cookMinutes: z.number().int().nonnegative().nullable().default(null),
  sourceUrl: z.string().nullable().default(null),
  ingredients: z.array(IngredientSchema).default([]),
  tags: z.array(z.string()).default([]),
  aliases: z.array(AliasSchema).default([]),
})

export type RecipeBody = z.infer<typeof RecipeBodySchema>
