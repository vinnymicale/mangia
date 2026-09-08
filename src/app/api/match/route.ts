import { NextResponse } from 'next/server'
import { z } from 'zod'
import { matchByIngredients } from '@/lib/db/search'

const BodySchema = z.object({
  names: z.array(z.string()).min(1),
  minCoverage: z.number().min(0).max(1).default(0.5),
})

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a non-empty "names" array.' }, { status: 400 })
  }
  const { names, minCoverage } = parsed.data
  return NextResponse.json({ matches: await matchByIngredients(names, { minCoverage }) })
}
