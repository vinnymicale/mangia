import { NextResponse } from 'next/server'
import { z } from 'zod'
import { renameTag, deleteTag } from '@/lib/db/tags'

const PatchSchema = z.object({ name: z.string().min(1) })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a "name" field.' }, { status: 400 })
  }

  const outcome = await renameTag(id, parsed.data.name)
  if (outcome === 'missing') {
    return NextResponse.json({ error: 'No such tag.' }, { status: 404 })
  }
  if (outcome === 'invalid') {
    return NextResponse.json({ error: 'A tag needs a name.' }, { status: 400 })
  }
  // The caller needs to know a merge happened: it folds this tag into another
  // one and the tag they were editing no longer exists.
  return NextResponse.json({ outcome })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await deleteTag(id))) {
    return NextResponse.json({ error: 'No such tag.' }, { status: 404 })
  }
  return NextResponse.json({ id })
}
