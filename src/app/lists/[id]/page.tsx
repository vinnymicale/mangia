import { notFound } from 'next/navigation'
import { getShoppingList } from '@/lib/db/shoppingList'
import { ShoppingListView } from '@/components/ShoppingListView'

export const dynamic = 'force-dynamic'

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const list = await getShoppingList(id)
  if (list === null) notFound()

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">{list.name}</h1>
      <ShoppingListView
        listId={list.id}
        items={list.items.map((item) => ({
          id: item.id,
          name: item.ingredient?.name ?? item.manualText ?? '',
          quantity: item.quantity,
          unit: item.unit,
          checked: item.checked,
          note: item.note,
          sourceTitles: item.sources.map((source) => source.recipe.title),
        }))}
      />
    </>
  )
}
