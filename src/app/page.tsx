import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listRecipes, type RecipeSort } from '@/lib/db/recipes'
import { BrowseControls } from '@/components/BrowseControls'
import { RecipeCard } from '@/components/RecipeCard'
import { button, card, PageTitle } from '@/components/ui'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const SORTS: RecipeSort[] = ['recent', 'title', 'time', 'cooked']

function toSort(raw: string | undefined): RecipeSort {
  return SORTS.includes(raw as RecipeSort) ? (raw as RecipeSort) : 'recent'
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tag?: string; maxMinutes?: string }>
}) {
  const { sort, tag, maxMinutes } = await searchParams
  const parsedMax = Number.parseInt(maxMinutes ?? '', 10)

  const [recipes, tagRows] = await Promise.all([
    listRecipes({
      sort: toSort(sort),
      tag: tag && tag !== '' ? tag : undefined,
      maxMinutes: Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : undefined,
    }),
    db.tag.findMany({ orderBy: { name: 'asc' } }),
  ])

  if (recipes.length === 0 && !tag && !maxMinutes) {
    return (
      <div className={cn(card, 'mx-auto max-w-md px-6 py-14 text-center')}>
        <h1 className="text-2xl font-semibold">No recipes yet</h1>
        <p className="mx-auto mt-2 max-w-xs text-(--color-ink-muted)">
          Paste one in, import from a link, or type it out.
        </p>
        <Link href="/recipes/new" className={cn(button({ size: 'lg' }), 'mt-7')}>
          Add your first recipe
        </Link>
      </div>
    )
  }

  return (
    <>
      <PageTitle count={`${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}`}>
        Recipes
      </PageTitle>
      <BrowseControls tags={tagRows.map((row) => row.name)} />
      {recipes.length === 0 ? (
        <p className="text-(--color-ink-muted)">Nothing matches those filters.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard {...recipe} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
