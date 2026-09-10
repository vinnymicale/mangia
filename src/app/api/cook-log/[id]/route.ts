import { NextResponse } from 'next/server'
import { deleteCookLogEntry } from '@/lib/db/cookLog'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await deleteCookLogEntry(id))) {
    return NextResponse.json({ error: 'No such entry.' }, { status: 404 })
  }
  return NextResponse.json({ id })
}
