import Link from 'next/link'
import { formatMinutes } from '@/lib/utils'

export interface RecipeCardProps {
  id: string
  title: string
  prepMinutes: number | null
  cookMinutes: number | null
  /** Optional footnote, e.g. "missing: butter, sage". */
  footnote?: string
  /**
   * Replaces the total-time line. Coverage results carry no timings, and
   * formatMinutes(0) would otherwise render a bare em-dash in that slot.
   */
  subtitle?: string
}

export function RecipeCard({ id, title, prepMinutes, cookMinutes, footnote, subtitle }: RecipeCardProps) {
  const total = (prepMinutes ?? 0) + (cookMinutes ?? 0)
  return (
    <Link
      href={`/recipes/${id}`}
      className="block rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-4 transition-shadow hover:shadow-md"
    >
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-(--color-ink-muted)">{subtitle ?? formatMinutes(total)}</p>
      {footnote && <p className="mt-2 text-sm text-amber-700">{footnote}</p>}
    </Link>
  )
}
