import { NextResponse } from 'next/server'
import { markCooked } from '@/lib/db/recipes'

/** Stamps the recipe as cooked now. Called from the cooking view. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const cookedAt = await markCooked(id)
  if (cookedAt === null) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  return NextResponse.json({ id, lastCookedAt: cookedAt.toISOString() })
}
