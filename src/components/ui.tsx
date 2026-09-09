import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Shared surface styling. Every button, field, and card in the app is built
 * from these so a change to the look lands everywhere at once.
 */

export const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-[7px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55',
  {
    variants: {
      variant: {
        primary: 'bg-(--color-accent) text-(--color-accent-ink) hover:bg-(--color-accent-h)',
        secondary:
          'border border-(--color-border-hi) text-(--color-ink) hover:border-(--color-ink) hover:bg-(--color-surface-hi)',
        ghost:
          'text-(--color-ink-2) hover:bg-(--color-surface-hi) hover:text-(--color-ink)',
      },
      size: {
        sm: 'px-3.5 py-1.5 text-[13px]',
        md: 'px-5 py-2.5 text-sm',
        lg: 'px-6 py-3 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonVariants = VariantProps<typeof button>

/** Text inputs, selects, and textareas. */
export const field = cn(
  'w-full rounded-[7px] border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5',
  'text-(--color-ink) placeholder:text-(--color-ink-2)/70',
  'transition-[color,background-color,border-color,box-shadow] hover:border-(--color-border-hi)',
  // The soft ring reads as focus without the jump a heavier outline causes.
  'focus:border-(--color-accent) focus:ring-[3px] focus:ring-(--color-accent-soft) focus:outline-none',
)

/** A raised panel: recipe cards, entry doors, prompts. */
export const card = cn(
  'rounded-[11px] border border-(--color-border) bg-(--color-surface) shadow-(--shadow-card)',
)

/** The small caps-free label above a grouped control. */
export const label = 'text-[13px] font-semibold tracking-[0.01em] text-(--color-ink)'

/**
 * Page heading. `count` renders as a quiet tally beside the title when
 * supplied — the mockup sets the two on one baseline rather than stacked.
 */
export function PageTitle({
  children,
  count,
  lede,
  action,
}: {
  children: React.ReactNode
  count?: string
  lede?: string
  action?: React.ReactNode
}) {
  return (
    <header className="mb-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-[-0.025em]">{children}</h1>
          {count && <p className="text-sm text-(--color-ink-2)">{count}</p>}
        </div>
        {action}
      </div>
      {lede && <p className="mt-3 max-w-prose text-(--color-ink-2)">{lede}</p>}
    </header>
  )
}

/**
 * The quiet "← Recipes" affordance the mockup puts above a detail view. It
 * sits in the left margin of the content, so it reads as a way back out
 * rather than as a primary action competing with the title.
 */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-7 inline-flex items-center gap-1.5 py-1 text-[13px] font-medium text-(--color-ink-2) transition-colors hover:text-(--color-ink) sm:mb-[30px]"
    >
      <ArrowLeft aria-hidden size={14} strokeWidth={1.75} />
      {children}
    </Link>
  )
}
