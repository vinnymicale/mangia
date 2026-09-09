'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { button, card } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface PickableRecipe {
  id: string
  title: string
}

export function RecipePicker({ recipes }: { recipes: PickableRecipe[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [excludeStaples, setExcludeStaples] = useState(true)
  const [busy, setBusy] = useState(false)

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function generate() {
    setBusy(true)
    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipeIds: [...selected], excludeStaples }),
      })
      const body = await response.json()
      router.push(`/lists/${body.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Build a list</h2>
      <p className="mt-1.5 text-sm text-(--color-ink-muted)">
        Choose the recipes you are cooking and mangia merges their ingredients.
      </p>

      <ul className={cn(card, 'mt-5 divide-y divide-(--color-border-subtle) overflow-hidden')}>
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors',
                selected.has(recipe.id) && 'bg-(--color-accent-soft)/50',
              )}
            >
              <input
                type="checkbox"
                className="size-4 shrink-0"
                checked={selected.has(recipe.id)}
                onChange={() => toggle(recipe.id)}
              />
              {recipe.title}
            </label>
          </li>
        ))}
      </ul>

      <label className="mt-5 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={excludeStaples}
          onChange={(event) => setExcludeStaples(event.target.checked)}
        />
        Skip staples I always have
      </label>

      <button
        type="button"
        disabled={busy || selected.size === 0}
        onClick={() => void generate()}
        className={cn(button({ size: 'lg' }), 'mt-5')}
      >
        {busy ? 'Building…' : `Make a list from ${selected.size} recipe${selected.size === 1 ? '' : 's'}`}
      </button>
    </section>
  )
}
