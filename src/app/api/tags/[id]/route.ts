import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { z } from 'zod'
import { renameTag, deleteTag } from '@/lib/db/tags'
import { TAG_KINDS, setTagKind } from '@/lib/db/tagKinds'

// Either field alone is a valid edit: renaming a tag and filing it under a
// kind are separate acts, and the row offers them as separate controls.
const PatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    kind: z.enum(TAG_KINDS).optional(),
  })
  .refine((body) => body.name !== undefined || body.kind !== undefined, {
    message: 'Expected a "name" or "kind" field.',
  })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a "name" field.' }, { status: 400 })
  }

  // The kind is addressed by name, so it is set before any rename: a merge
  // can remove this tag entirely, and there would be nothing left to file.
  if (parsed.data.kind !== undefined) {
    const tag = await db.tag.findUnique({ where: { id } })
    if (tag === null) {
      return NextResponse.json({ error: 'No such tag.' }, { status: 404 })
    }
    await setTagKind(tag.name, parsed.data.kind)
    if (parsed.data.name === undefined) {
      return NextResponse.json({ outcome: 'classified' })
    }
  }

  const outcome = await renameTag(id, parsed.data.name!)
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
