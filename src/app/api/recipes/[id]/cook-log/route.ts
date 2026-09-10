import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listCookLog, logCook } from '@/lib/db/cookLog'

const PostSchema = z.object({
  cookedAt: z.string().optional(),
  note: z.string().nullish(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const entries = await listCookLog(id)
  return NextResponse.json({
    entries: entries.map((entry) => ({ ...entry, cookedAt: entry.cookedAt.toISOString() })),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = PostSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a cook log entry.' }, { status: 400 })
  }

  // An explicit date lets the user record a cook they forgot to log at the
  // time; an unparseable one falls back to now rather than failing the write.
  const supplied = parsed.data.cookedAt ? new Date(parsed.data.cookedAt) : null
  const cookedAt = supplied && !Number.isNaN(supplied.getTime()) ? supplied : undefined

  const entry = await logCook(id, { cookedAt, note: parsed.data.note ?? null })
  if (entry === null) {
    return NextResponse.json({ error: 'No such recipe.' }, { status: 404 })
  }
  return NextResponse.json({ ...entry, cookedAt: entry.cookedAt.toISOString() })
}
