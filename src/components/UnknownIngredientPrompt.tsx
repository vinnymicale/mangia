'use client'

import { card } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface AliasChoice {
  alias: string
  canonical: string
}

export interface UnknownIngredientPromptProps {
  unknown: string[]
  choices: AliasChoice[]
  onChange: (next: AliasChoice[]) => void
}

/**
 * Shown on save when a recipe introduces ingredient names the library has
 * never seen. The default is to accept them as new — linking is opt-in, so
 * saving is never blocked on vocabulary bookkeeping.
 */
export function UnknownIngredientPrompt({
  unknown,
  choices,
  onChange,
}: UnknownIngredientPromptProps) {
  if (unknown.length === 0) return null

  function setCanonical(alias: string, canonical: string) {
    const rest = choices.filter((choice) => choice.alias !== alias)
    onChange(canonical.trim() === '' ? rest : [...rest, { alias, canonical: canonical.trim() }])
  }

  return (
    <section className={cn(card, 'border-(--color-accent)/30 bg-(--color-accent-soft)/40 p-5')}>
      <h2 className="text-lg font-semibold">New to your library</h2>
      <p className="mt-1.5 max-w-prose text-sm text-(--color-ink-muted)">
        These will be added as new ingredients. If one is another name for
        something you already have, say so and they will match in future searches.
      </p>
      <ul className="mt-4 space-y-2">
        {unknown.map((name) => (
          <li key={name} className="flex flex-wrap items-center gap-2">
            <span className="min-w-32 text-sm font-medium">{name}</span>
            <label className="flex-1 text-sm">
              <span className="sr-only">Same as, for {name}</span>
              <input
                placeholder="same as… (optional)"
                className="w-full rounded-md border border-(--color-border-subtle) bg-(--color-surface-raised) px-2 py-1.5 text-sm transition-colors hover:border-(--color-border-strong) focus:border-(--color-accent) focus:outline-none"
                onChange={(event) => setCanonical(name, event.target.value)}
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
