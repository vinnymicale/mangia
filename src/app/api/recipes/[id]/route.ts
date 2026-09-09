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

  await updateRecipe(id, parsed.data)
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
