import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getRecipeNutrition, resolveRecipeNutrition } from '@/lib/nutrition/resolve'
import { nutritionServices } from '@/lib/nutrition/services'

/** The estimate from stored data. Never touches the network, so the page can render it at once. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const nutrition = await getRecipeNutrition(id)
  if (nutrition === null) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  return NextResponse.json(nutrition)
}

const PostSchema = z.object({ retryUnmatched: z.boolean().default(false) })

/**
 * Looks up whatever the estimate is missing, then answers with the result. An
 * unreachable USDA is not an error here: the answer is the partial estimate
 * with `usdaUnavailable` set, which the page shows as a notice.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // An empty body is the common case -- the page's automatic resolve sends none.
  const text = await request.text()
  let body: unknown = {}
  if (text.trim() !== '') {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected an optional boolean "retryUnmatched".' }, { status: 400 })
  }

  const services = await nutritionServices()
  const nutrition = await resolveRecipeNutrition(id, { ...parsed.data, ...services })
  if (nutrition === null) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  return NextResponse.json(nutrition)
}
