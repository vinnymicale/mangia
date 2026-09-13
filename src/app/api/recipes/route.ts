import { NextResponse } from 'next/server'
import { createRecipe } from '@/lib/db/recipes'
import { setRecipePhoto } from '@/lib/db/photos'
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
  // The photo does not: `createRecipe` takes a `RecipeInput`, which has no
  // room for bytes, so it is split off and written after the recipe exists.
  const { photo, ...recipe } = parsed.data
  const id = await createRecipe(recipe)

  if (photo !== null) {
    // A photo is a nicety; the recipe the cook just typed is not. Losing the
    // save over a failed blob write would be the worse outcome, so this is
    // logged and swallowed rather than turned into an error response.
    try {
      await setRecipePhoto(id, Buffer.from(photo.data, 'base64'), photo.mimeType)
    } catch (error) {
      console.error('Failed to store the recipe photo:', error)
    }
  }

  return NextResponse.json({ id }, { status: 201 })
}
