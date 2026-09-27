'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatNutrient } from '@/lib/nutrition/format'
import { NUTRIENT_KEYS, NUTRIENT_LABELS } from '@/lib/nutrition/types'
import type { LineStatus, NutritionLine, RecipeNutrition } from '@/lib/nutrition/compute'
import { OverrideEditor } from './OverrideEditor'
import { ResolveGap, type Gap } from './ResolveGap'
import { requestJson } from './request'

const STATUS_LABELS: Record<LineStatus, string> = {
  counted: 'Counted',
  needsNutrition: 'Needs nutrition',
  needsWeight: 'Needs weight',
  noQuantity: 'No quantity',
  blank: 'Left blank',
  pending: 'Not looked up',
}

/** One gap per ingredient and unit, however many lines share it. */
function gapsOf(lines: NutritionLine[]): Gap[] {
  const gaps = new Map<string, Gap>()
  for (const line of lines) {
    if (line.status !== 'needsNutrition' && line.status !== 'needsWeight') continue
    const unit = line.status === 'needsWeight' ? line.unit : null
    const key = `${line.status}\u0000${line.ingredientId}\u0000${unit ?? ''}`
    if (!gaps.has(key)) {
      gaps.set(key, { kind: line.status, ingredientId: line.ingredientId, name: line.name, unit })
    }
  }
  return [...gaps.values()]
}

function gapKey(gap: Gap): string {
  return `${gap.kind}\u0000${gap.ingredientId}\u0000${gap.unit ?? ''}`
}

/**
 * The recipe's estimated nutrition, and everything needed to improve it.
 *
 * Seeded from stored data by the server page, which touches no network; if
 * anything has never been looked up, the lookup starts on mount and the
 * figures fill in when it answers. router.refresh keeps the kcal figure in the
 * page header in step.
 */
export function NutritionPanel({
  recipeId,
  initial,
  aiConfigured,
}: {
  recipeId: string
  initial: RecipeNutrition
  aiConfigured: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [nutrition, setNutrition] = useState(initial)
  const [estimating, setEstimating] = useState(false)
  const [usdaUnavailable, setUsdaUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [overriding, setOverriding] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const show = useCallback(
    (next: RecipeNutrition) => {
      setNutrition(next)
      startTransition(() => router.refresh())
    },
    [router],
  )

  const estimate = useCallback(
    async (retryUnmatched: boolean) => {
      setEstimating(true)
      setError(null)
      const result = await requestJson<RecipeNutrition & { usdaUnavailable: boolean }>(
        `/api/recipes/${recipeId}/nutrition`,
        { method: 'POST', body: { retryUnmatched } },
      )
      setEstimating(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      const { usdaUnavailable: unavailable, ...next } = result.data
      setUsdaUnavailable(unavailable)
      show(next)
    },
    [recipeId, show],
  )

  // Once per mount, even under StrictMode's double effect: the lookup writes.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !initial.pending) return
    started.current = true
    void estimate(false)
  }, [initial.pending, estimate])

  /** After the cook fills a gap: re-read, and look up anything the fix uncovered. */
  async function reload() {
    const result = await requestJson<RecipeNutrition>(`/api/recipes/${recipeId}/nutrition`)
    if (!result.ok) {
      setError(result.error)
      return
    }
    show(result.data)
    if (result.data.pending) void estimate(false)
  }

  const gaps = gapsOf(nutrition.lines).filter((gap) => !dismissed.has(gapKey(gap)))
  const hasFigures = nutrition.source !== 'none'
  const basisLabel = nutrition.basis === 'serving' ? 'Per serving' : 'Whole recipe'

  return (
    <section aria-labelledby={`nutrition-${recipeId}`} className="mt-8">
      <h2 id={`nutrition-${recipeId}`} className="eyebrow">
        Nutrition
      </h2>

      {hasFigures ? (
        <>
          <p className="mt-1 text-xs text-(--color-ink-2)">{basisLabel}, estimated</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4">
            {NUTRIENT_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-baseline justify-between border-b border-(--color-border) py-1.5"
              >
                <dt className="text-[13px] text-(--color-ink-2)">{NUTRIENT_LABELS[key].label}</dt>
                <dd className="tnum text-[13.5px] font-semibold">
                  {formatNutrient(key, nutrition.totals[key])}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-(--color-ink-2)">
            {nutrition.source === 'override'
              ? (nutrition.overrideNote ?? 'Entered by hand')
              : `Estimate covers ${nutrition.counted} of ${nutrition.countable} ingredients`}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-(--color-ink-2)">
          {estimating ? 'Estimating…' : 'No estimate yet.'}
        </p>
      )}

      {estimating && hasFigures && <p className="mt-2 text-xs text-(--color-ink-2)">Estimating…</p>}
      {usdaUnavailable && (
        <p className="mt-2 text-sm text-(--color-alert)">
          FoodData Central could not be reached, so this estimate is incomplete. Try again later.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-(--color-alert)">{error}</p>}

      {gaps.length > 0 && (
        <button
          type="button"
          onClick={() => setResolving((open) => !open)}
          aria-expanded={resolving}
          className="mt-2 text-sm font-semibold text-(--color-accent) underline underline-offset-2"
        >
          {gaps.length === 1 ? '1 ingredient needs input' : `${gaps.length} ingredients need input`}
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {(nutrition.pending || !hasFigures) && (
          <button
            type="button"
            onClick={() => void estimate(false)}
            disabled={estimating}
            className={button({ variant: 'secondary', size: 'sm' })}
          >
            Estimate macros
          </button>
        )}
        {nutrition.needsInput > 0 && (
          <button
            type="button"
            onClick={() => void estimate(true)}
            disabled={estimating}
            className={button({ variant: 'ghost', size: 'sm' })}
          >
            Retry unmatched
          </button>
        )}
        <button
          type="button"
          onClick={() => setOverriding((open) => !open)}
          aria-expanded={overriding}
          className={button({ variant: 'ghost', size: 'sm' })}
        >
          Override
        </button>
      </div>

      {resolving && gaps.length > 0 && (
        <ul className="mt-3">
          {gaps.map((gap) => (
            <ResolveGap
              key={gapKey(gap)}
              gap={gap}
              aiConfigured={aiConfigured}
              onSaved={() => void reload()}
              onDismiss={() => setDismissed((current) => new Set(current).add(gapKey(gap)))}
            />
          ))}
        </ul>
      )}

      {overriding && (
        <OverrideEditor
          recipeId={recipeId}
          current={nutrition.source === 'override' ? nutrition.totals : null}
          note={nutrition.source === 'override' ? nutrition.overrideNote : null}
          onSaved={(next) => {
            setOverriding(false)
            show(next)
          }}
        />
      )}

      {nutrition.lines.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-(--color-ink-2)">
            Breakdown
          </summary>
          <ul className="mt-2 space-y-2">
            {nutrition.lines.map((line) => (
              <li key={line.recipeIngredientId} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{line.name}</span>
                  <span className={cn('tnum', line.status !== 'counted' && 'text-(--color-ink-2)')}>
                    {line.status === 'counted'
                      ? `${Math.round(line.grams!)} g · ${formatNutrient('kcal', line.nutrients!.kcal)}`
                      : STATUS_LABELS[line.status]}
                  </span>
                </div>
                {line.fdcDescription && (
                  <span className="block text-(--color-ink-2) italic">{line.fdcDescription}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
