import { notFound } from 'next/navigation'
import { getRecipe } from '@/lib/db/recipes'
import { CookingView } from '@/components/CookingView'
import { toParagraphs, toSteps } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function CookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (recipe === null) notFound()

  return (
    <CookingView
      recipeId={recipe.id}
      title={recipe.title}
      lastCookedAt={recipe.lastCookedAt?.toISOString() ?? null}
      steps={toSteps(recipe.instructions)}
      notes={recipe.notes === null ? [] : toParagraphs(recipe.notes)}
      ingredients={recipe.ingredients.map((row) => ({
        id: row.id,
        quantity: row.quantity,
        unit: row.unit,
        name: row.ingredient.name,
        note: row.note,
      }))}
    />
  )
}
