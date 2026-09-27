import { NextResponse } from 'next/server'
import { listIngredientNutrition, type IngredientFilter } from '@/lib/db/nutrition'

const FILTERS: IngredientFilter[] = ['all', 'gaps', 'empty']

/** Every ingredient in use with its nutrition, weights and recipe count. */
export async function GET(request: Request) {
  const filter = new URL(request.url).searchParams.get('filter') ?? 'all'
  if (!FILTERS.includes(filter as IngredientFilter)) {
    return NextResponse.json({ error: 'Expected a "filter" of "all", "gaps" or "empty".' }, { status: 400 })
  }
  return NextResponse.json({ ingredients: await listIngredientNutrition(filter as IngredientFilter) })
}
