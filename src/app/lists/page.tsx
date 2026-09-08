import Link from 'next/link'
import { listShoppingLists } from '@/lib/db/shoppingList'
import { listRecipes } from '@/lib/db/recipes'
import { RecipePicker } from '@/components/RecipePicker'

export const dynamic = 'force-dynamic'

export default async function ListsPage() {
  const [lists, recipes] = await Promise.all([
    listShoppingLists(),
    listRecipes({ sort: 'recent' }),
  ])

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Shopping lists</h1>
        {lists.length === 0 ? (
          <p className="text-(--color-ink-muted)">No lists yet.</p>
        ) : (
          <ul className="space-y-2">
            {lists.map((list) => (
              <li key={list.id}>
                <Link href={`/lists/${list.id}`} className="underline">
                  {list.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <hr className="border-(--color-border-subtle)" />

      <RecipePicker recipes={recipes.map(({ id, title }) => ({ id, title }))} />
    </div>
  )
}
