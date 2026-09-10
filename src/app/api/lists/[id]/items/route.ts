import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  toggleItemChecked,
  addManualItem,
  clearCheckedItems,
} from '@/lib/db/shoppingList'

const PostSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
})

const PatchSchema = z.object({ itemId: z.string().min(1), checked: z.boolean() })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a "name" field.' }, { status: 400 })
  }
  const item = await addManualItem(id, parsed.data)
  return NextResponse.json(
    {
      id: item.id,
      // addManualItem links an ingredient only when the name is already
      // known, so a non-food entry like "batteries" comes back unlinked and
      // the typed name is what the row is called.
      name: item.ingredient?.name ?? parsed.data.name,
      quantity: item.quantity,
      unit: item.unit,
      checked: item.checked,
      note: item.note,
      // The list groups by category, so it has to come back with the item or
      // every newly added row lands in "Other" until the page is reloaded.
      category: item.ingredient?.category ?? null,
    },
    { status: 201 },
  )
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await params
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected "itemId" and "checked".' }, { status: 400 })
  }
  await toggleItemChecked(parsed.data.itemId, parsed.data.checked)
  return NextResponse.json({ ok: true })
}

/**
 * Clears the checked items off a list. Scoped to the list in the path, so
 * there is no body to validate -- there is nothing else this can mean.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return NextResponse.json({ removed: await clearCheckedItems(id) })
}
