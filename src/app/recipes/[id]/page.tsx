import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChefHat, Pencil, Printer } from 'lucide-react'
import { getRecipe } from '@/lib/db/recipes'
import { listCookLog } from '@/lib/db/cookLog'
import { hasRecipePhoto } from '@/lib/db/photos'
import { BackLink, button, card } from '@/components/ui'
import { DeleteButton } from '@/components/DeleteButton'
import { CookHistory } from '@/components/CookHistory'
import {
  cn,
  formatMinutes,
  formatQuantity,
  safeExternalUrl,
  toParagraphs,
  toSteps,
} from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * One entry in the prep/cook/serves panel beside the title. The value is set
 * large in the display face so the three numbers read as a glanceable
 * summary rather than as a definition list.
 */
function Stat({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-(--color-border) px-4 py-3 first:border-t-0">
      <dt className="eyebrow">{term}</dt>
      <dd className="tnum mt-1 font-serif text-3xl font-extrabold">{children}</dd>
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

  const cookLog = await listCookLog(recipe.id)
  // Only whether one exists: the bytes are served by their own route, so the
  // page never carries a photo through the HTML.
  const photo = await hasRecipePhoto(recipe.id)

  return (
    <article>
      <BackLink href="/">Recipes</BackLink>
      <header className="border-b border-(--color-border) pb-8 sm:pb-9">
        {/* Title and stats share the width: the panel gives the numbers a home
            on the right rather than leaving that half of the header empty. */}
        <div className="gap-11 lg:grid lg:grid-cols-[1fr_11.25rem] lg:items-start">
          <div>
            {/* Above the title, as in the mockup: the tags set the expectation
                for what kind of dish this is before the name is read. */}
            {recipe.tags.length > 0 && (
              <ul className="mb-3.5 flex flex-wrap gap-1.5">
                {recipe.tags.map((link) => (
                  <li
                    key={link.tag.id}
                    className="rounded-[5px] bg-(--color-accent-soft) px-2.5 py-1 text-[11px] font-semibold tracking-[0.05em] uppercase text-(--color-accent)"
                  >
                    {link.tag.name}
                  </li>
                ))}
              </ul>
            )}
            <h1 className="text-4xl leading-[0.98] font-extrabold tracking-[-0.035em] text-balance italic sm:text-[52px]">
              {recipe.title}
            </h1>
            {recipe.description && (
              <p className="mt-4 max-w-[56ch] text-base leading-[1.65] text-(--color-ink-2)">
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
              <Link
                href={`/recipes/${recipe.id}/print`}
                className={button({ variant: 'ghost', size: 'lg' })}
              >
                <Printer className="size-4" aria-hidden />
                Print
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
              <DeleteButton
                endpoint={`/api/recipes/${recipe.id}`}
                redirectTo="/"
                label="Delete"
                confirmLabel="Delete recipe"
                size="lg"
              />
            </div>
          </div>

          <dl className={cn(card, 'mt-8 overflow-hidden lg:mt-0')}>
            <Stat term="Prep">{formatMinutes(recipe.prepMinutes)}</Stat>
            <Stat term="Cook">{formatMinutes(recipe.cookMinutes)}</Stat>
            <Stat term="Serves">{recipe.servings ?? '—'}</Stat>
          </dl>
        </div>
      </header>

      <div className="mt-10 gap-13 lg:grid lg:grid-cols-[16.875rem_1fr]">
        {/* The list stays in view while the method scrolls past it. */}
        <section className="h-fit lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)]">
          <h2 className="eyebrow">Ingredients</h2>
          {/* Quantity and name are columns, not a sentence: the aligned
              measures let a cook check off the mise en place down one edge. */}
          <ul className="mt-3">
            {recipe.ingredients.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[4.875rem_1fr] gap-3 border-b border-(--color-border) py-2.5 first:border-t first:border-(--color-border)"
              >
                <span className="tnum text-right text-[13.5px] font-semibold text-(--color-accent)">
                  {[formatQuantity(row.quantity), row.unit]
                    .filter(Boolean)
                    .join(' ')}
                </span>
                <span className="text-sm">
                  {row.ingredient.name}
                  {row.note && (
                    <span className="block text-xs text-(--color-ink-2) italic">
                      {row.note}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 lg:mt-0">
          <h2 className="eyebrow">Instructions</h2>
          {/* Numbered because the steps genuinely are a sequence -- and a
              cook glancing back mid-recipe needs to find their place again. */}
          <ol className="mt-5 max-w-prose space-y-7">
            {toSteps(recipe.instructions).map((step, index) => (
              <li key={index} className="grid grid-cols-[2.375rem_1fr] gap-4.5">
                <span
                  aria-hidden
                  className="tnum flex size-[38px] items-center justify-center rounded-full border-[1.5px] border-(--color-border-hi) text-[13px] font-bold text-(--color-ink-2)"
                >
                  {index + 1}
                </span>
                <span className="text-base leading-[1.72]">{step}</span>
              </li>
            ))}
          </ol>

          {/* The cook's own record, kept below the method: it is read after
              the recipe is already familiar, and it is what carries over from
              the last time this was made. Blank lines start new paragraphs so
              notes accumulated across several cooks stay legible. */}
          {recipe.notes && (
            <div className="mt-12 border-t border-(--color-border) pt-8">
              <h2 className="eyebrow">Notes</h2>
              <div className="mt-4 max-w-prose space-y-3.5">
                {toParagraphs(recipe.notes).map((note, index) => (
                  <p key={index} className="text-base leading-[1.72] text-(--color-ink-2)">
                    {note}
                  </p>
                ))}
              </div>
            </div>
          )}
          {/* The card this was read from, for the handwriting, the splashes,
              and whatever the parse could not make out. Collapsed because the
              typed recipe above is the one being cooked from, and hidden in
              print for the same reason. */}
          {photo && (
            <details className="mt-12 border-t border-(--color-border) pt-8 print:hidden">
              <summary className="eyebrow cursor-pointer">Original photo</summary>
              {/* eslint-disable-next-line @next/next/no-img-element -- served
                  from a route that streams bytes out of the database. */}
              <img
                src={`/api/recipes/${recipe.id}/photo`}
                alt={`The photo ${recipe.title} was read from`}
                className="mt-4 max-h-[36rem] rounded-lg border border-(--color-border)"
              />
            </details>
          )}
          {/* Below the method and the notes: history is what the cook consults
              after deciding to make this again, not while reading it. */}
          <CookHistory
            recipeId={recipe.id}
            initialEntries={cookLog.map((entry) => ({
              id: entry.id,
              cookedAt: entry.cookedAt.toISOString(),
              note: entry.note,
            }))}
          />
        </section>
      </div>
    </article>
  )
}
