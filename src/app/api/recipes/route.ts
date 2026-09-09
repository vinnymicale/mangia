import { NextResponse } from 'next/server'
import { createRecipe } from '@/lib/db/recipes'
import { RecipeBodySchema } from '@/lib/api/recipeSchema'

export async function POST(request: Request) {
  const parsed = RecipeBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid recipe.', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  // Alias links travel with the recipe so they are applied in the same
  // transaction as the save -- a failed save leaves no orphan alias behind.
  const id = await createRecipe(parsed.data)
  return NextResponse.json({ id }, { status: 201 })
}
