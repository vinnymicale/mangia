import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { listShoppingLists } from '@/lib/db/shoppingList'
import { listRecipes } from '@/lib/db/recipes'
import { RecipePicker } from '@/components/RecipePicker'
import { card, PageTitle } from '@/components/ui'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ListsPage() {
  const [lists, recipes] = await Promise.all([
    listShoppingLists(),
    listRecipes({ sort: 'recent' }),
  ])

  return (
    <div className="space-y-12">
      <section>
        <PageTitle>Shopping lists</PageTitle>
        {lists.length === 0 ? (
          <p className="text-(--color-ink-2)">
            No lists yet. Pick a few recipes below to build one.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {lists.map((list) => (
              <li key={list.id}>
                <Link
                  href={`/lists/${list.id}`}
                  className={cn(
                    card,
                    'flex items-center justify-between gap-3 px-5 py-4 font-medium transition-colors hover:border-(--color-accent)/40 hover:text-(--color-accent)',
                  )}
                >
                  {list.name}
                  <ChevronRight className="size-4 shrink-0 text-(--color-ink-2)" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecipePicker recipes={recipes.map(({ id, title }) => ({ id, title }))} />
    </div>
  )
}
