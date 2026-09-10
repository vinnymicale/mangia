import Link from 'next/link'
import { cookStats, recentCooks, staleRecipes } from '@/lib/db/cookLog'
import { PageTitle, card } from '@/components/ui'
import { cn, formatCookDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * The kitchen diary: every recipe's cooks interleaved.
 *
 * Three questions that a single lastCookedAt column could never answer, side
 * by side -- what has been made lately, what gets made most, and what has been
 * quietly forgotten. The last one is the useful one: a recipe box accumulates
 * dishes far faster than a household cooks through them.
 */
export default async function DiaryPage() {
  const [recent, stats, stale] = await Promise.all([
    recentCooks(50),
    cookStats(),
    staleRecipes(8),
  ])

  return (
    <>
      <PageTitle lede="Every meal you've logged, what you cook most, and what has been waiting a while.">
        Kitchen Diary
      </PageTitle>

      {recent.length === 0 ? (
        <p className="text-(--color-ink-2)">
          Nothing logged yet. Cooking a recipe, or logging a past cook from its page,
          fills this in.
        </p>
      ) : (
        <div className="gap-9 lg:grid lg:grid-cols-[1fr_18rem] lg:items-start">
          <section aria-label="Recent cooks">
            <h2 className="eyebrow">Recent</h2>
            <ul className="mt-3 border-t border-(--color-border)">
              {recent.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1 border-b border-(--color-border) py-3"
                >
                  <span className="tnum w-32 shrink-0 text-sm font-semibold text-(--color-ink-2)">
                    {formatCookDate(entry.cookedAt)}
                  </span>
                  <Link
                    href={`/recipes/${entry.recipeId}`}
                    className="font-serif text-lg font-bold hover:text-(--color-accent)"
                  >
                    {entry.title}
                  </Link>
                  {entry.note && (
                    <span className="w-full text-sm text-(--color-ink-2) sm:w-auto">
                      {entry.note}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-9 space-y-6 lg:mt-0">
            <Panel title="Cooked most" rows={stats.slice(0, 8)} showCount />
            {/* Never-cooked recipes are deliberately absent: "have I ever made
                this?" is a different question, and there are enough of them to
                bury the ones that were loved and then forgotten. */}
            <Panel title="Not for a while" rows={stale} />
          </div>
        </div>
      )}
    </>
  )
}

function Panel({
  title,
  rows,
  showCount = false,
}: {
  title: string
  rows: { recipeId: string; title: string; count: number; lastCookedAt: Date }[]
  showCount?: boolean
}) {
  if (rows.length === 0) return null
  return (
    <section aria-label={title} className={cn(card, 'p-4')}>
      <h2 className="eyebrow">{title}</h2>
      <ul className="mt-2.5 space-y-1.5">
        {rows.map((row) => (
          <li key={row.recipeId} className="flex items-baseline justify-between gap-3">
            <Link
              href={`/recipes/${row.recipeId}`}
              className="text-sm hover:text-(--color-accent)"
            >
              {row.title}
            </Link>
            <span className="tnum shrink-0 text-xs font-semibold text-(--color-ink-2)">
              {showCount
                ? `${row.count}×`
                : formatCookDate(row.lastCookedAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
