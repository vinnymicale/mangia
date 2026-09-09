import { notFound } from 'next/navigation'
import { getShoppingList } from '@/lib/db/shoppingList'
import { ShoppingListView } from '@/components/ShoppingListView'
import { BackLink, PageTitle } from '@/components/ui'

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
  // The recipes this list was built from, named once at the top. Answering
  // "where did this come from?" here keeps it off every individual row.
  const sources = [
    ...new Set(
      list.items.flatMap((item) => item.sources.map((source) => source.recipe.title)),
    ),
  ]

  return (
    <div className="max-w-3xl">
      <BackLink href="/lists">Lists</BackLink>
      <PageTitle count={`${list.items.length} ${list.items.length === 1 ? 'item' : 'items'}`}>
        {list.name}
      </PageTitle>
      {sources.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-0.5">From</span>
          {sources.map((title) => (
            <span
              key={title}
              className="rounded-[5px] bg-(--color-accent-soft) px-2.5 py-1 font-serif text-xs font-medium text-(--color-accent) italic"
            >
              {title}
            </span>
          ))}
        </div>
      )}
      <ShoppingListView
        listId={list.id}
        items={list.items.map((item) => ({
          id: item.id,
          name: item.ingredient?.name ?? item.manualText ?? '',
          quantity: item.quantity,
          unit: item.unit,
          checked: item.checked,
          note: item.note,
          category: item.ingredient?.category ?? null,
          sourceTitles: item.sources.map((source) => source.recipe.title),
        }))}
      />
    </div>
  )
}
