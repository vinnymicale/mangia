import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listRecipes, type RecipeSort } from '@/lib/db/recipes'
import { BrowseControls } from '@/components/BrowseControls'
import { RecipeCard } from '@/components/RecipeCard'

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
      <div className="py-20 text-center">
        <h1 className="text-2xl font-semibold">No recipes yet</h1>
        <p className="mt-2 text-(--color-ink-muted)">
          Paste one in, import from a link, or type it out.
        </p>
        <Link
          href="/recipes/new"
          className="mt-6 inline-block rounded-lg bg-(--color-accent) px-5 py-2.5 font-medium text-(--color-accent-ink)"
        >
          Add your first recipe
        </Link>
      </div>
    )
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Recipes</h1>
      <BrowseControls tags={tagRows.map((row) => row.name)} />
      {recipes.length === 0 ? (
        <p className="text-(--color-ink-muted)">Nothing matches those filters.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
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
