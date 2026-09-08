import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChefHat, Pencil } from 'lucide-react'
import { getRecipe } from '@/lib/db/recipes'
import { formatMinutes, formatQuantity } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (recipe === null) notFound()

  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">{recipe.title}</h1>
        {recipe.description && (
          <p className="mt-2 text-(--color-ink-muted)">{recipe.description}</p>
        )}
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-(--color-ink-muted)">
          <div><dt className="inline">Prep: </dt><dd className="inline">{formatMinutes(recipe.prepMinutes)}</dd></div>
          <div><dt className="inline">Cook: </dt><dd className="inline">{formatMinutes(recipe.cookMinutes)}</dd></div>
          <div><dt className="inline">Serves: </dt><dd className="inline">{recipe.servings ?? '—'}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/recipes/${recipe.id}/cook`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-(--color-accent) px-4 py-2 font-medium text-(--color-accent-ink)"
          >
            <ChefHat className="size-4" aria-hidden />
            Cook this
          </Link>
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-(--color-border-subtle) px-4 py-2 font-medium"
          >
            <Pencil className="size-4" aria-hidden />
            Edit
          </Link>
        </div>
        {recipe.sourceUrl && (
          <p className="mt-3 text-sm">
            <a href={recipe.sourceUrl} className="text-(--color-ink-muted) underline">
              Source
            </a>
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Ingredients</h2>
        <ul className="space-y-1.5">
          {recipe.ingredients.map((row) => (
            <li key={row.id}>
              <span className="font-medium">
                {[formatQuantity(row.quantity), row.unit].filter(Boolean).join(' ')}
              </span>{' '}
              {row.ingredient.name}
              {row.note && (
                <span className="text-(--color-ink-muted)">, {row.note}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Instructions</h2>
        <div className="whitespace-pre-wrap leading-relaxed">{recipe.instructions}</div>
      </section>

      {recipe.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {recipe.tags.map((link) => (
            <li
              key={link.tag.id}
              className="rounded-full border border-(--color-border-subtle) px-3 py-1 text-sm text-(--color-ink-muted)"
            >
              {link.tag.name}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
