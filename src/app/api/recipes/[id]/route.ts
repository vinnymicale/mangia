import { NextResponse } from 'next/server'
import { updateRecipe, deleteRecipe, getRecipe } from '@/lib/db/recipes'
import { RecipeBodySchema } from '@/lib/api/recipeSchema'

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
  const parsed = RecipeBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid recipe.', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  // An edit shares the create schema, but the photo is written once at import
  // time and never edited afterwards, so it is dropped here rather than
  // re-saved -- `updateRecipe` has no field for it either way.
  const { photo: _photo, ...recipe } = parsed.data
  await updateRecipe(id, recipe)
  return NextResponse.json({ id })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await deleteRecipe(id))) {
    return NextResponse.json({ error: 'No such recipe.' }, { status: 404 })
  }
  return NextResponse.json({ id })
}
