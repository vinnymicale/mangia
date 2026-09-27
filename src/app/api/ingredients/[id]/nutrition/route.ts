import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getIngredientNutrition,
  ingredientExists,
  upsertIngredientNutrition,
  upsertUnitWeight,
} from '@/lib/db/nutrition'
import { canonicalUnit, isWeightUnit } from '@/lib/nutrition/compute'
import {
  EMPTY_NUTRIENTS,
  hasAnyNutrient,
  NUTRIENT_KEYS,
  NutrientsSchema,
  validateNutrientsPer100g,
  validateUnitWeight,
  type Nutrients,
} from '@/lib/nutrition/types'

const BodySchema = z.union([
  // The cook leaving this ingredient blank; it is never asked about again.
  z.object({ source: z.literal('none') }),
  z.object({
    // `ai` when the cook saved a suggestion as given, so the badge stays honest.
    source: z.enum(['manual', 'ai']).default('manual'),
    nutrients: NutrientsSchema,
    /**
     * The amount the values describe when not 100 g: "one onion, 110 g". The
     * values are scaled to 100 g, and the weight is kept for the recipe too.
     */
    per: z.object({ unit: z.string().nullable(), grams: z.number() }).nullable().default(null),
  }),
])

function scale(nutrients: Nutrients, factor: number): Nutrients {
  const scaled = { ...nutrients }
  for (const key of NUTRIENT_KEYS) {
    const value = nutrients[key]
    if (value !== null) scaled[key] = Math.round(value * factor * 100) / 100
  }
  return scaled
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid nutrition.', issues: parsed.error.issues }, { status: 400 })
  }
  if (!(await ingredientExists(id))) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  // The USDA match is kept through a manual edit, so "Reset to USDA" can
  // still find its way back.
  const current = (await getIngredientNutrition(id)).nutrition
  const match = { fdcId: current?.fdcId ?? null, fdcDescription: current?.fdcDescription ?? null }
  const body = parsed.data

  if (body.source === 'none') {
    await upsertIngredientNutrition(id, { ...EMPTY_NUTRIENTS, source: 'none', ...match })
    return NextResponse.json(await getIngredientNutrition(id))
  }

  if (!hasAnyNutrient(body.nutrients)) {
    return NextResponse.json({ error: 'Give at least one value, or leave it blank.' }, { status: 400 })
  }
  if (body.per && !validateUnitWeight(body.per.grams)) {
    return NextResponse.json({ error: 'The weight must be more than 0 g and at most 5 kg.' }, { status: 400 })
  }

  const per100g = body.per ? scale(body.nutrients, 100 / body.per.grams) : body.nutrients
  if (!validateNutrientsPer100g(per100g)) {
    return NextResponse.json(
      { error: 'Those values are not plausible for 100 g of any food. Check the amounts.' },
      { status: 400 },
    )
  }

  await upsertIngredientNutrition(id, { ...per100g, source: body.source, ...match })
  if (body.per) {
    const unit = canonicalUnit(body.per.unit)
    // A weight unit converts itself; storing "1 ounce = 28 g" would add nothing.
    if (!isWeightUnit(unit)) await upsertUnitWeight(id, unit, body.per.grams, 'manual')
  }
  return NextResponse.json(await getIngredientNutrition(id))
}
