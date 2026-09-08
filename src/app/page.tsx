import Link from 'next/link'
import { listRecipes } from '@/lib/db/recipes'
import { formatMinutes } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const recipes = await listRecipes({ sort: 'recent' })

  if (recipes.length === 0) {
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
      <ul className="grid gap-4 sm:grid-cols-2">
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <Link
              href={`/recipes/${recipe.id}`}
              className="block rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-4 transition-shadow hover:shadow-md"
            >
              <h2 className="font-medium">{recipe.title}</h2>
              <p className="mt-1 text-sm text-(--color-ink-muted)">
                {formatMinutes((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0))}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
