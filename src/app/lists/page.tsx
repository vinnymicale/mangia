import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { listShoppingLists } from '@/lib/db/shoppingList'
import { listRecipes } from '@/lib/db/recipes'
import { RecipePicker } from '@/components/RecipePicker'
import { card, PageTitle } from '@/components/ui'
import { DeleteButton } from '@/components/DeleteButton'
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
              <li
                key={list.id}
                className={cn(card, 'flex items-center gap-2 pr-3')}
              >
                {/* The delete control is a sibling of the link, not a child:
                    a button nested inside an anchor is invalid markup and the
                    click would navigate as well as delete. */}
                <Link
                  href={`/lists/${list.id}`}
                  className="flex flex-1 items-center justify-between gap-3 px-5 py-4 font-medium transition-colors hover:text-(--color-accent)"
                >
                  {list.name}
                  <ChevronRight className="size-4 shrink-0 text-(--color-ink-2)" aria-hidden />
                </Link>
                <DeleteButton
                  endpoint={`/api/lists/${list.id}`}
                  redirectTo="/lists"
                  name={`Delete ${list.name}`}
                  confirmLabel="Delete list"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecipePicker recipes={recipes.map(({ id, title }) => ({ id, title }))} />
    </div>
  )
}
