import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateShoppingList } from '@/lib/db/shoppingList'

const BodySchema = z.object({
  recipeIds: z.array(z.string()).min(1),
  name: z.string().optional(),
  excludeStaples: z.boolean().default(true),
})

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a non-empty "recipeIds" array.' }, { status: 400 })
  }
  const { recipeIds, name, excludeStaples } = parsed.data
  const id = await generateShoppingList(recipeIds, { name, excludeStaples })
  return NextResponse.json({ id }, { status: 201 })
}
