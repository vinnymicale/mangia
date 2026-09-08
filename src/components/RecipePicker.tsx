'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <section className="space-y-4">
      <h2 className="font-medium">Build a list</h2>
      <ul className="space-y-2">
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="size-4"
                checked={selected.has(recipe.id)}
                onChange={() => toggle(recipe.id)}
              />
              {recipe.title}
            </label>
          </li>
        ))}
      </ul>

      <label className="flex items-center gap-2 text-sm">
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
        className="rounded-lg bg-(--color-accent) px-4 py-2 font-medium text-(--color-accent-ink) disabled:opacity-60"
      >
        {busy ? 'Building…' : `Make a list from ${selected.size} recipe${selected.size === 1 ? '' : 's'}`}
      </button>
    </section>
  )
}
