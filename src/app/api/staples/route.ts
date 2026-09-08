import { NextResponse } from 'next/server'
import { z } from 'zod'
import { addStaple, removeStaple } from '@/lib/db/staples'

const PostSchema = z.object({ name: z.string().min(1) })
const DeleteSchema = z.object({ id: z.string().min(1) })

export async function POST(request: Request) {
  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a "name" field.' }, { status: 400 })
  }
  const staple = await addStaple(parsed.data.name)
  return NextResponse.json(staple, { status: 201 })
}

export async function DELETE(request: Request) {
  const parsed = DeleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected an "id" field.' }, { status: 400 })
  }
  await removeStaple(parsed.data.id)
  return NextResponse.json({ ok: true })
}
