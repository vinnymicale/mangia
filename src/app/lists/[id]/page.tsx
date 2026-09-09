import { notFound } from 'next/navigation'
import { getShoppingList } from '@/lib/db/shoppingList'
import { ShoppingListView } from '@/components/ShoppingListView'
import { PageTitle } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const list = await getShoppingList(id)
  if (list === null) notFound()

  // A checklist reads better in a narrow column than stretched across the
  // full shell width, where each row would be a checkbox and a lot of nothing.
  return (
    <div className="max-w-3xl">
      <PageTitle count={`${list.items.length} ${list.items.length === 1 ? 'item' : 'items'}`}>
        {list.name}
      </PageTitle>
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
    </div>
  )
}
