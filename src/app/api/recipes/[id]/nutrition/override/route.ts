import { NextResponse } from 'next/server'
import { clearOverride, setOverride } from '@/lib/db/nutrition'
import { getRecipeNutrition } from '@/lib/nutrition/resolve'
import { NutritionOverrideSchema } from '@/lib/nutrition/types'

/** Sets the per-serving override and answers with the recomputed estimate. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = NutritionOverrideSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid override.', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  // Checked first: the write would otherwise fail on the foreign key as a 500.
  if ((await getRecipeNutrition(id)) === null) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  await setOverride(id, parsed.data)
  return NextResponse.json(await getRecipeNutrition(id))
}

/** Clears the override, so the per-ingredient estimate shows again. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await clearOverride(id)
  const nutrition = await getRecipeNutrition(id)
  if (nutrition === null) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  return NextResponse.json(nutrition)
}
