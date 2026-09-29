'use client'

import { useRef } from 'react'
import { ChartPie, X } from 'lucide-react'
import { button, card } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { RecipeNutrition } from '@/lib/nutrition/compute'
import { NutritionPanel } from './NutritionPanel'

/**
 * The recipe's nutrition, behind a button in the action row. A native modal
 * dialog rather than a panel on the page: the figures and their editors are
 * consulted now and then, and given a column of their own they crowded the
 * ingredient list that is read every time.
 *
 * The panel is mounted while the dialog is closed, so the automatic lookup
 * still starts with the page and the header's calorie figure fills in without
 * the cook having to open anything.
 */
export function NutritionDialog({
  recipeId,
  initial,
  aiConfigured,
}: {
  recipeId: string
  initial: RecipeNutrition
  aiConfigured: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        className={button({ variant: 'ghost', size: 'lg' })}
      >
        <ChartPie className="size-4" aria-hidden />
        Nutrition
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`nutrition-${recipeId}`}
        // A click that lands on the dialog itself, not its content, is a click
        // on the backdrop.
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
        className={cn(
          card,
          'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto p-0 text-(--color-ink)',
          'backdrop:bg-(--color-ink)/40',
        )}
      >
        <div className="relative p-6 sm:p-7">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className={cn(button({ variant: 'ghost', size: 'sm' }), 'absolute top-4 right-4 px-2')}
          >
            <X className="size-4" aria-hidden />
          </button>
          <NutritionPanel recipeId={recipeId} initial={initial} aiConfigured={aiConfigured} />
        </div>
      </dialog>
    </>
  )
}
