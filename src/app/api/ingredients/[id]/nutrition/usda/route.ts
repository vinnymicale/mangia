import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  deleteUnitWeightsBySource,
  getIngredientNutrition,
  ingredientExists,
  upsertIngredientNutrition,
} from '@/lib/db/nutrition'
import { nutritionServices } from '@/lib/nutrition/services'
import { validateNutrientsPer100g } from '@/lib/nutrition/types'
import { getFoods, UsdaUnavailableError } from '@/lib/nutrition/usda'

const BodySchema = z.object({ fdcId: z.number().int().positive() })

/** Matches the ingredient to a USDA food the cook chose, or resets it to its known match. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a numeric "fdcId".' }, { status: 400 })
  }
  if (!(await ingredientExists(id))) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const { usda } = await nutritionServices()
  let food
  try {
    ;[food] = await getFoods([parsed.data.fdcId], usda)
  } catch (error) {
    if (error instanceof UsdaUnavailableError) {
      return NextResponse.json({ error: 'FoodData Central is unavailable. Try again later.' }, { status: 502 })
    }
    throw error
  }
  if (!food) {
    return NextResponse.json({ error: 'No such USDA food.' }, { status: 404 })
  }
  if (!validateNutrientsPer100g(food.nutrients)) {
    return NextResponse.json({ error: 'That food\'s USDA values are not usable.' }, { status: 422 })
  }

  await upsertIngredientNutrition(id, {
    ...food.nutrients, source: 'usda', fdcId: food.fdcId, fdcDescription: food.description,
  })
  // Portions and failed lookups belonged to the old food; the next resolve
  // refills them from this one. Weights the cook or a model gave are kept.
  await deleteUnitWeightsBySource(id, ['usda', 'unmatched'])
  return NextResponse.json(await getIngredientNutrition(id))
}
