import { NextResponse } from 'next/server'
import { z } from 'zod'
import { parseIngredientBlob } from '@/lib/parsing/parseIngredient'

const BodySchema = z.object({ text: z.string().min(1) })

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a non-empty "text" field.' }, { status: 400 })
  }
  return NextResponse.json({ ingredients: parseIngredientBlob(parsed.data.text) })
}
