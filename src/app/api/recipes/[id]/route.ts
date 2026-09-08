import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateRecipe, deleteRecipe, getRecipe } from '@/lib/db/recipes'
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
  aliases: z
    .array(z.object({ alias: z.string().min(1), canonical: z.string().min(1) }))
    .default([]),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (recipe === null) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  return NextResponse.json(recipe)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid recipe.', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { aliases, ...recipe } = parsed.data
  for (const { alias, canonical } of aliases) {
    await linkAlias(alias, canonical)
  }

  await updateRecipe(id, recipe)
  return NextResponse.json({ id })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await deleteRecipe(id)
  return NextResponse.json({ id })
}
