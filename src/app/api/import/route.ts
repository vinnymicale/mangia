import { NextResponse } from 'next/server'
import { z } from 'zod'
import { importFromUrl } from '@/lib/import/webImporter'

const BodySchema = z.object({ url: z.string().min(1) })

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a "url" field.' }, { status: 400 })
  }

  try {
    const result = await importFromUrl(parsed.data.url)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Import failed: ${message}` }, { status: 502 })
  }
}
