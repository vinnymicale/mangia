import { listIngredientNutrition } from '@/lib/db/nutrition'
import { IngredientNutritionTable } from '@/components/nutrition/IngredientNutritionTable'
import { PageTitle } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * What the macro estimates are built from, per ingredient. Correcting a value
 * here corrects it in every recipe that uses the ingredient.
 */
export default async function IngredientsPage() {
  const rows = await listIngredientNutrition()

  return (
    <>
      <PageTitle
        count={rows.length === 1 ? '1 ingredient' : `${rows.length} ingredients`}
        lede="Nutrition per ingredient, used for every recipe's macro estimate. A change here applies everywhere."
      >
        Ingredients
      </PageTitle>
      <IngredientNutritionTable initial={rows} />
    </>
  )
}
