import Link from 'next/link'
import { Clock, Users } from 'lucide-react'
import { formatMinutes } from '@/lib/utils'

export interface RecipeCardProps {
  id: string
  title: string
  prepMinutes: number | null
  cookMinutes: number | null
  description?: string | null
  servings?: number | null
  /** Shape matches the `tags: { include: { tag: true } }` browse query. */
  tags?: { tag: { id: string; name: string } }[]
  /** Optional footnote, e.g. "missing: butter, sage". */
  footnote?: string
  /**
   * Replaces the total-time line. Coverage results carry no timings, and
   * formatMinutes(0) would otherwise render a bare em-dash in that slot.
   */
  subtitle?: string
  /**
   * Fraction of the recipe's ingredients on hand, 0-1. Draws a proportion bar
   * behind the subtitle: pantry results are a comparison, and a ratio in prose
   * is hard to rank a grid of cards by at a glance.
   */
  coverage?: number
}

export function RecipeCard({
  id,
  title,
  prepMinutes,
  cookMinutes,
  description,
  servings,
  tags,
  footnote,
  subtitle,
  coverage,
}: RecipeCardProps) {
  const total = (prepMinutes ?? 0) + (cookMinutes ?? 0)
  const hasTime = subtitle === undefined && total > 0
  // Two is all that fits on one line at the narrowest column without wrapping.
  const shown = tags?.slice(0, 2) ?? []

  return (
    <Link
      href={`/recipes/${id}`}
      className="group flex h-full flex-col gap-[9px] rounded-[11px] border border-(--color-border) bg-(--color-surface) px-[22px] pt-5 pb-[18px] shadow-(--shadow-card) transition-[box-shadow,border-color,transform] hover:-translate-y-0.5 hover:border-(--color-border-hi) hover:shadow-(--shadow-card-hover)"
    >
      {/* Tags lead the card: they orient a scan of the grid before the
          title is read, and keep every title on the same baseline. */}
      {shown.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map((link) => (
            <li
              key={link.tag.id}
              className="rounded-[4px] bg-(--color-accent-soft) px-1.5 py-0.5 text-[10px] font-bold tracking-[0.07em] uppercase text-(--color-accent)"
            >
              {link.tag.name}
            </li>
          ))}
        </ul>
      )}

      <h2 className="flex-1 font-serif text-[18.5px] leading-[1.2] font-bold tracking-[-0.01em] text-balance italic">
        {title}
      </h2>

      {description && (
        <p className="line-clamp-2 text-[13px] leading-[1.55] text-(--color-ink-2)">
          {description}
        </p>
      )}

      {/* The bar sits with the ratio it measures, so a grid of results can be
          scanned by length rather than by reading each fraction. */}
      {coverage !== undefined && (
        <div
          aria-hidden
          className="h-1 overflow-hidden rounded-full bg-(--color-border)"
        >
          <div
            className="h-full rounded-full bg-(--color-accent)"
            style={{ width: `${Math.round(coverage * 100)}%` }}
          />
        </div>
      )}

      {/* The meta row is pinned to the bottom so cards in a row align on it
          however much description each one carries. */}
      <div className="mt-auto flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t border-(--color-border) pt-[11px] text-xs text-(--color-ink-2)">
        <span className="flex items-center gap-1.5">
          {hasTime && (
            <Clock className="size-3 shrink-0 opacity-65" aria-hidden />
          )}
          <span className="tnum">{subtitle ?? formatMinutes(total)}</span>
        </span>
        {subtitle === undefined && servings != null && (
          <span className="flex items-center gap-1.5">
            <Users className="size-3 shrink-0 opacity-65" aria-hidden />
            <span className="tnum">Serves {servings}</span>
          </span>
        )}
      </div>

      {footnote && (
        <p className="text-xs text-(--color-ink-2)">{footnote}</p>
      )}
    </Link>
  )
}
