import { NextResponse } from 'next/server'
import { nutritionServices } from '@/lib/nutrition/services'
import { searchFoods, UsdaUnavailableError } from '@/lib/nutrition/usda'

/** Candidate foods for the manual picker. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (query === '') {
    return NextResponse.json({ error: 'Expected a search term "q".' }, { status: 400 })
  }
  const { usda } = await nutritionServices()
  try {
    return NextResponse.json({ results: await searchFoods(query, usda) })
  } catch (error) {
    if (error instanceof UsdaUnavailableError) {
      return NextResponse.json({ error: 'FoodData Central is unavailable. Try again later.' }, { status: 502 })
    }
    throw error
  }
}
