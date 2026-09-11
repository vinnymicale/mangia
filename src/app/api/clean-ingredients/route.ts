import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProvider } from '@/lib/llm'

const BodySchema = z.object({ lines: z.array(z.string()).min(1) })

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a non-empty "lines" array.' }, { status: 400 })
  }

  try {
    const provider = await getProvider()
    const ingredients = await provider.parseIngredientLines(parsed.data.lines)
    return NextResponse.json({ ingredients })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Clean-up failed: ${message}` }, { status: 502 })
  }
}
