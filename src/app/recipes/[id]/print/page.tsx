import { notFound } from 'next/navigation'
import { getRecipe } from '@/lib/db/recipes'
import { BackLink } from '@/components/ui'
import { PrintButton } from '@/components/PrintButton'
import { formatMinutes, formatQuantity, toParagraphs, toSteps } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * A kitchen card: the recipe with everything else stripped out, sized to fall
 * on one sheet where it can. A cook with floury hands wants paper, not a
 * screen -- and the app's own chrome, colours and sticky columns are all
 * things a printer would waste ink on.
 */
export default async function PrintRecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (recipe === null) notFound()

  const times = [
    recipe.prepMinutes !== null && `Prep ${formatMinutes(recipe.prepMinutes)}`,
    recipe.cookMinutes !== null && `Cook ${formatMinutes(recipe.cookMinutes)}`,
    recipe.servings !== null && `Serves ${recipe.servings}`,
  ].filter(Boolean) as string[]

  return (
    <div className="print-card">
      {/* Screen-only: on paper these are dead pixels, and the back link would
          print as underlined text pointing nowhere. */}
      <div className="print:hidden">
        <BackLink href={`/recipes/${recipe.id}`}>{recipe.title}</BackLink>
      </div>

      <article className="mx-auto max-w-[42rem]">
        <header className="border-b-2 border-(--color-ink) pb-4">
          <h1 className="font-serif text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] italic">
            {recipe.title}
          </h1>
          {recipe.description && (
            <p className="mt-2.5 text-[13.5px] leading-[1.6] text-(--color-ink-2)">
              {recipe.description}
            </p>
          )}
          {times.length > 0 && (
            <p className="tnum mt-3 text-[12px] font-semibold tracking-[0.04em] uppercase text-(--color-ink-2)">
              {times.join('  ·  ')}
            </p>
          )}
        </header>

        <div className="mt-6 flex justify-end print:hidden">
          <PrintButton />
        </div>

        <section className="mt-6">
          <h2 className="eyebrow">Ingredients</h2>
          {/* Two columns on paper: an ingredient list is short lines, and one
              column down a full sheet wastes the half that pushes the method
              onto a second page. */}
          <ul className="mt-2.5 columns-2 gap-8 text-[13.5px] print:text-[11.5pt]">
            {recipe.ingredients.map((row) => (
              <li
                key={row.id}
                className="mb-1.5 break-inside-avoid leading-[1.5]"
              >
                <span className="tnum font-semibold">
                  {[formatQuantity(row.quantity), row.unit].filter(Boolean).join(' ')}
                </span>{' '}
                {row.ingredient.name}
                {row.note && <span className="italic"> ({row.note})</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-7">
          <h2 className="eyebrow">Instructions</h2>
          <ol className="mt-3 space-y-3">
            {toSteps(recipe.instructions).map((step, index) => (
              <li
                key={index}
                className="grid break-inside-avoid grid-cols-[1.5rem_1fr] gap-3 text-[13.5px] leading-[1.6] print:text-[11.5pt]"
              >
                <span aria-hidden className="tnum font-bold">
                  {index + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {recipe.notes && (
          <section className="mt-7 break-inside-avoid border-t border-(--color-border) pt-4">
            <h2 className="eyebrow">Notes</h2>
            <div className="mt-2 space-y-2">
              {toParagraphs(recipe.notes).map((note, index) => (
                <p key={index} className="text-[13px] leading-[1.6] text-(--color-ink-2)">
                  {note}
                </p>
              ))}
            </div>
          </section>
        )}

        {recipe.sourceUrl && (
          <p className="mt-6 hidden text-[10pt] text-(--color-ink-2) print:block">
            {recipe.sourceUrl}
          </p>
        )}
      </article>
    </div>
  )
}
