import { NextResponse } from 'next/server'
import { getShoppingList, deleteShoppingList } from '@/lib/db/shoppingList'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const list = await getShoppingList(id)
  if (list === null) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  return NextResponse.json(list)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!(await deleteShoppingList(id))) {
    return NextResponse.json({ error: 'No such list.' }, { status: 404 })
  }
  return NextResponse.json({ id })
}
