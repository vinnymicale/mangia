import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRecipe } from '@/lib/db/recipes'
import { linkAlias } from '@/lib/db/ingredients'

const IngredientSchema = z.object({
  quantity: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
  ingredient: z.string().min(1),
  note: z.string().nullable().default(null),
  rawText: z.string().default(''),
  // Carried through because RecipeInput requires it; the client may omit it.
  confidence: z.enum(['high', 'low']).default('high'),
})

const AliasSchema = z.object({ alias: z.string().min(1), canonical: z.string().min(1) })

const BodySchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  instructions: z.string().default(''),
  servings: z.number().int().positive().nullable().default(null),
  prepMinutes: z.number().int().nonnegative().nullable().default(null),
  cookMinutes: z.number().int().nonnegative().nullable().default(null),
  sourceUrl: z.string().nullable().default(null),
  ingredients: z.array(IngredientSchema).default([]),
  tags: z.array(z.string()).default([]),
  aliases: z.array(AliasSchema).default([]),
})

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid recipe.', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { aliases, ...recipe } = parsed.data
  // Aliases are linked first so the ingredients resolve to the canonical rows
  // the user just confirmed.
  for (const { alias, canonical } of aliases) {
    await linkAlias(alias, canonical)
  }

  const id = await createRecipe(recipe)
  return NextResponse.json({ id }, { status: 201 })
}
