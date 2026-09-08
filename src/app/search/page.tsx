import { db } from '@/lib/db/client'
import { searchRecipes } from '@/lib/db/search'
import { RecipeCard } from '@/components/RecipeCard'
import { PantrySearch } from '@/components/PantrySearch'

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
    ids.length === 0
      ? []
      : await db.recipe.findMany({ where: { id: { in: ids } } })
  // FTS returns ids in relevance order; findMany does not preserve it.
  const ranked = ids
    .map((id) => found.find((recipe) => recipe.id === id))
    .filter((recipe): recipe is NonNullable<typeof recipe> => recipe !== undefined)

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Search</h1>
        <form action="/search" className="flex gap-2">
          <input
            name="q"
            aria-label="Search recipes"
            placeholder="carbonara, braise, anything"
            defaultValue={query}
            className="min-w-0 flex-1 rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-lg bg-(--color-accent) px-4 py-2 font-medium text-(--color-accent-ink)"
          >
            Search
          </button>
        </form>

        {query !== '' && ranked.length === 0 && (
          <p className="mt-4 text-(--color-ink-muted)">No recipes match “{query}”.</p>
        )}

        {ranked.length > 0 && (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {ranked.map((recipe) => (
              <li key={recipe.id}>
                <RecipeCard {...recipe} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <hr className="border-(--color-border-subtle)" />

      <PantrySearch />
    </div>
  )
}
