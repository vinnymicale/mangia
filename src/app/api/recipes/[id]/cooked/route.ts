import { NextResponse } from 'next/server'
import { logCook } from '@/lib/db/cookLog'

/**
 * Stamps the recipe as cooked now. Called from the cooking view.
 *
 * This writes a log entry rather than only touching Recipe.lastCookedAt: the
 * button was already the moment the user tells us a dish was made, so routing
 * it through the log is what makes history accumulate without asking them to
 * do anything new. logCook keeps lastCookedAt in agreement.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const entry = await logCook(id, {})
  if (entry === null) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  return NextResponse.json({ id, lastCookedAt: entry.cookedAt.toISOString() })
}
