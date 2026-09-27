import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  deleteUnitWeight,
  getIngredientNutrition,
  ingredientExists,
  upsertUnitWeight,
} from '@/lib/db/nutrition'
import { canonicalUnit, isWeightUnit } from '@/lib/nutrition/compute'
import { validateUnitWeight } from '@/lib/nutrition/types'

const PutSchema = z.object({
  /** Null for a bare count: "1 onion". */
  unit: z.string().nullable(),
  /** Null leaves this unit blank, which is never asked about again. */
  grams: z.number().nullable(),
})

/** Sets how much one of a unit weighs, or marks it as left blank. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = PutSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected "unit" and "grams".' }, { status: 400 })
  }
  const unit = canonicalUnit(parsed.data.unit)
  const { grams } = parsed.data
  if (isWeightUnit(unit)) {
    return NextResponse.json({ error: 'A weight unit needs no weight.' }, { status: 400 })
  }
  if (grams !== null && !validateUnitWeight(grams)) {
    return NextResponse.json({ error: 'The weight must be more than 0 g and at most 5 kg.' }, { status: 400 })
  }
  if (!(await ingredientExists(id))) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  await upsertUnitWeight(id, unit, grams, grams === null ? 'none' : 'manual')
  return NextResponse.json(await getIngredientNutrition(id))
}

/**
 * Removes a stored weight, so the next resolve looks it up again. The unit is
 * a query parameter; leaving it out means the bare count.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const unit = canonicalUnit(new URL(request.url).searchParams.get('unit'))
  if (!(await deleteUnitWeight(id, unit))) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  return NextResponse.json(await getIngredientNutrition(id))
}
