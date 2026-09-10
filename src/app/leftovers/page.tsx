import Link from 'next/link'
import { recipesUsing, suggestLeftovers } from '@/lib/db/leftovers'
import { PageTitle, button, card, field } from '@/components/ui'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * The pantry search from the other end.
 *
 * Pantry asks "here is everything I have, what can I make?" and ranks on how
 * little is missing. This asks "half a tub of ricotta is going off, what uses
 * it?" and ranks on how little else is needed. Same table, opposite question,
 * and the second one is the one asked standing in front of an open fridge.
 */
export default async function LeftoversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''
  const [matches, suggestions] = await Promise.all([
    query === '' ? Promise.resolve([]) : recipesUsing(query),
    suggestLeftovers(12),
  ])

  return (
    <>
      <PageTitle lede="Name the thing that needs eating. Recipes that ask least of you come first.">
        Use it up
      </PageTitle>

      {/* A GET form rather than a fetch: the answer is worth keeping open in a
          tab while you cook, and a URL survives that where component state
          does not. */}
      <form action="/leftovers" className="flex max-w-2xl gap-2">
        <input
          type="search"
          name="q"
          aria-label="Leftover ingredient"
          placeholder="ricotta, half a lemon, that bunch of dill"
          defaultValue={query}
          className={cn(field, 'min-w-0 flex-1')}
        />
        <button type="submit" className={button()}>
          What uses it?
        </button>
      </form>

      {query !== '' && matches.length === 0 && (
        <p className="mt-6 text-(--color-ink-2)">No recipe calls for that.</p>
      )}

      {matches.length > 0 && (
        <section aria-label="Recipes using this" className="mt-8">
          <ul className="grid gap-3">
            {matches.map((match) => (
              <li key={match.recipeId}>
                <Link
                  href={`/recipes/${match.recipeId}`}
                  className={cn(
                    card,
                    'block p-4 transition-colors hover:border-(--color-border-hi)',
                  )}
                >
                  <span className="font-serif text-lg font-bold">{match.title}</span>
                  {/* What else is needed, not what is missing: the pantry
                      search knows what is in the kitchen and this does not,
                      so promising anything about a shop would be a guess. */}
                  <span className="mt-1 block text-sm text-(--color-ink-2)">
                    {match.otherIngredients.length === 0
                      ? 'Nothing else needed.'
                      : `Also needs ${match.otherIngredients.join(', ')}.`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {query === '' && suggestions.length > 0 && (
        <section aria-label="Common leftovers" className="mt-10">
          <h2 className="font-serif text-lg font-bold">Things you cook with often</h2>
          {/* Offered because an empty box is a dead end, and because these are
              exactly the ingredients bought in quantities a single recipe
              never finishes. */}
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.name}>
                <Link
                  href={`/leftovers?q=${encodeURIComponent(suggestion.name)}`}
                  className={cn(button({ variant: 'secondary', size: 'sm' }))}
                >
                  {suggestion.name}
                  <span className="text-(--color-ink-2)">{suggestion.recipeCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
