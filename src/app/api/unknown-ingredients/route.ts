import { NextResponse } from 'next/server'
import { z } from 'zod'
import { findUnknownNames } from '@/lib/db/ingredients'

const BodySchema = z.object({ names: z.array(z.string()).default([]) })

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a "names" array.' }, { status: 400 })
  }
  return NextResponse.json({ unknown: await findUnknownNames(parsed.data.names) })
}
