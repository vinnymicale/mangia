import { notFound } from 'next/navigation'
import { getRecipe } from '@/lib/db/recipes'
import { CookingView } from '@/components/CookingView'

export const dynamic = 'force-dynamic'

/** Splits instructions on blank lines, falling back to single newlines. */
function toSteps(instructions: string): string[] {
  const paragraphs = instructions
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (paragraphs.length > 1) return paragraphs
  return instructions
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean)
}

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
      title={recipe.title}
      steps={toSteps(recipe.instructions)}
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
