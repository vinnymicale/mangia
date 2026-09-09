import { notFound } from 'next/navigation'
import { getRecipe } from '@/lib/db/recipes'
import { RecipeForm, type RecipeFormValue } from '@/components/RecipeForm'
import { BackLink, PageTitle } from '@/components/ui'

export const dynamic = 'force-dynamic'

type StoredRecipe = NonNullable<Awaited<ReturnType<typeof getRecipe>>>

function toFormValue(recipe: StoredRecipe): RecipeFormValue {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    instructions: recipe.instructions,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    sourceUrl: recipe.sourceUrl,
    tags: recipe.tags.map((link) => link.tag.name),
    ingredients: recipe.ingredients.map((row) => ({
      quantity: row.quantity,
      unit: row.unit,
      ingredient: row.ingredient.name,
      note: row.note,
      rawText: row.rawText,
      // Saved rows have already been reviewed by a human.
      confidence: 'high' as const,
    })),
  }
}

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (recipe === null) notFound()

  return (
    <>
      <BackLink href={`/recipes/${recipe.id}`}>{recipe.title}</BackLink>
      <PageTitle>Edit recipe</PageTitle>
      <RecipeForm initial={toFormValue(recipe)} />
    </>
  )
}
