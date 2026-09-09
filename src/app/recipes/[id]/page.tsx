import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChefHat, Pencil } from 'lucide-react'
import { getRecipe } from '@/lib/db/recipes'
import { button, card } from '@/components/ui'
import {
  cn,
  formatMinutes,
  formatQuantity,
  safeExternalUrl,
  toSteps,
} from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** One entry in the prep/cook/serves panel beside the title. */
function Stat({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="text-sm text-(--color-ink-muted)">{term}</dt>
      <dd className="tnum text-lg font-medium">{children}</dd>
    </div>
  )
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (recipe === null) notFound()

  return (
    <article>
      <header className="border-b border-(--color-border-subtle) pb-8">
        {/* Title and stats share the width: the panel gives the numbers a home
            on the right rather than leaving that half of the header empty. */}
        <div className="gap-10 lg:grid lg:grid-cols-[1fr_15rem] lg:items-start">
          <div>
            <h1 className="text-4xl leading-tight font-semibold text-balance sm:text-5xl">
              {recipe.title}
            </h1>
            {recipe.description && (
              <p className="mt-3 max-w-prose text-lg text-(--color-ink-muted)">
                {recipe.description}
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={`/recipes/${recipe.id}/cook`}
                className={button({ size: 'lg' })}
              >
                <ChefHat className="size-4" aria-hidden />
                Cook this
              </Link>
              <Link
                href={`/recipes/${recipe.id}/edit`}
                className={button({ variant: 'secondary', size: 'lg' })}
              >
                <Pencil className="size-4" aria-hidden />
                Edit
              </Link>
              {safeExternalUrl(recipe.sourceUrl) && (
                <a
                  href={safeExternalUrl(recipe.sourceUrl)!}
                  rel="noreferrer noopener"
                  className={button({ variant: 'ghost', size: 'lg' })}
                >
                  Source
                </a>
              )}
            </div>
          </div>

          <dl className={cn(card, 'mt-8 space-y-3 p-5 lg:mt-0')}>
            <Stat term="Prep">{formatMinutes(recipe.prepMinutes)}</Stat>
            <Stat term="Cook">{formatMinutes(recipe.cookMinutes)}</Stat>
            <Stat term="Serves">{recipe.servings ?? '—'}</Stat>
          </dl>
        </div>
      </header>

      <div className="mt-8 gap-10 lg:grid lg:grid-cols-[21rem_1fr]">
        {/* The list stays in view while the method scrolls past it. */}
        <section className={cn(card, 'h-fit p-6 lg:sticky lg:top-8')}>
          <h2 className="text-xl font-semibold">Ingredients</h2>
          <ul className="mt-4 space-y-2.5">
            {recipe.ingredients.map((row) => (
              <li key={row.id} className="flex gap-2.5">
                <span className="tnum shrink-0 font-medium text-(--color-accent)">
                  {[formatQuantity(row.quantity), row.unit]
                    .filter(Boolean)
                    .join(' ')}
                </span>
                <span>
                  {row.ingredient.name}
                  {row.note && (
                    <span className="text-(--color-ink-muted)">
                      , {row.note}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 lg:mt-0">
          <h2 className="text-xl font-semibold">Instructions</h2>
          {/* Numbered because the steps genuinely are a sequence -- and a
              cook glancing back mid-recipe needs to find their place again. */}
          <ol className="mt-5 max-w-prose space-y-4">
            {toSteps(recipe.instructions).map((step, index) => (
              <li key={index} className="flex gap-4">
                <span
                  aria-hidden
                  className="tnum mt-0.5 shrink-0 text-sm font-medium text-(--color-accent)"
                >
                  {index + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          {recipe.tags.length > 0 && (
            <ul className="mt-10 flex flex-wrap gap-2">
              {recipe.tags.map((link) => (
                <li
                  key={link.tag.id}
                  className="rounded-full bg-(--color-accent-soft) px-3 py-1 text-sm text-(--color-accent)"
                >
                  {link.tag.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  )
}
