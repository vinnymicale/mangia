import { NextResponse } from 'next/server'
import { z } from 'zod'
import { nutritionServices } from '@/lib/nutrition/services'
import { validateNutrientsPer100g } from '@/lib/nutrition/types'

const BodySchema = z.object({ name: z.string().trim().min(1) })

/**
 * A model's per-100 g guess, to pre-fill the manual form. Nothing is stored:
 * the cook reviews it first, and only a save writes it.
 */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a "name" field.' }, { status: 400 })
  }
  const { provider } = await nutritionServices()
  if (!provider) {
    return NextResponse.json({ error: 'No AI provider is configured.' }, { status: 409 })
  }

  let nutrients
  try {
    nutrients = await provider.estimateNutrition(parsed.data.name)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'The AI provider failed.' },
      { status: 502 },
    )
  }
  if (!validateNutrientsPer100g(nutrients)) {
    return NextResponse.json({ error: 'The suggestion was not plausible.' }, { status: 502 })
  }
  return NextResponse.json({ nutrients })
}
