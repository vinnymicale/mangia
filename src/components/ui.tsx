import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Shared surface styling. Every button, field, and card in the app is built
 * from these so a change to the look lands everywhere at once.
 */

export const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55',
  {
    variants: {
      variant: {
        primary:
          'bg-(--color-accent) text-(--color-accent-ink) hover:bg-(--color-accent-hover) shadow-(--shadow-card)',
        secondary:
          'border border-(--color-border-strong) bg-(--color-surface-raised) text-(--color-ink) hover:border-(--color-accent) hover:text-(--color-accent)',
        ghost:
          'text-(--color-ink-muted) hover:bg-(--color-surface-sunken) hover:text-(--color-ink)',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2.5 text-sm',
        lg: 'px-6 py-3 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonVariants = VariantProps<typeof button>

/** Text inputs, selects, and textareas. */
export const field = cn(
  'w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2.5',
  'text-(--color-ink) placeholder:text-(--color-ink-muted)/70',
  'transition-colors hover:border-(--color-border-strong)',
  'focus:border-(--color-accent) focus:outline-none',
)

/** A raised panel: recipe cards, entry doors, prompts. */
export const card = cn(
  'rounded-2xl border border-(--color-border-subtle) bg-(--color-surface-raised) shadow-(--shadow-card)',
)

/** The small caps-free label above a grouped control. */
export const label = 'text-sm font-medium text-(--color-ink)'

/**
 * Page heading with the olive rule that acts as the app's structural motif.
 * `count` renders as a quiet tally beside the title when supplied.
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
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {children}
          </h1>
          {count && (
            <p className="mt-1.5 text-sm text-(--color-ink-muted)">{count}</p>
          )}
        </div>
        {action}
      </div>
      {lede && (
        <p className="mt-3 max-w-prose text-(--color-ink-muted)">{lede}</p>
      )}
      <div
        aria-hidden
        className="mt-5 h-px w-full bg-linear-to-r from-(--color-accent)/50 to-transparent"
      />
    </header>
  )
}
