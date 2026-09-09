import { db } from '@/lib/db/client'
import { searchRecipes } from '@/lib/db/search'
import { RecipeCard } from '@/components/RecipeCard'
import { PageTitle, button, field } from '@/components/ui'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''
  const ids = query === '' ? [] : await searchRecipes(query)
  const found =
    ids.length === 0 ? [] : await db.recipe.findMany({ where: { id: { in: ids } } })
  // FTS returns ids in relevance order; findMany does not preserve it.
  const ranked = ids
    .map((id) => found.find((recipe) => recipe.id === id))
    .filter((recipe): recipe is NonNullable<typeof recipe> => recipe !== undefined)

  return (
    <>
      <PageTitle lede="Find a recipe by name, ingredient, or anything in the method. Looking to cook from what's in the kitchen instead? Try the pantry.">
        Search
      </PageTitle>

      <form action="/search" className="flex max-w-2xl gap-2">
        <input
          name="q"
          aria-label="Search recipes by text"
          placeholder="carbonara, braise, anything"
          defaultValue={query}
          className={cn(field, 'min-w-0 flex-1')}
        />
        <button type="submit" className={button()}>
          Search
        </button>
      </form>

      {query !== '' && ranked.length === 0 && (
        <p className="mt-6 text-(--color-ink-2)">No recipes match “{query}”.</p>
      )}

      {ranked.length > 0 && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard {...recipe} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
