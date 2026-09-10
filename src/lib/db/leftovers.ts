import { db } from './client'
import { normalizeIngredientName } from './ingredients'

export interface LeftoverMatch {
  recipeId: string
  title: string
  /** Everything the recipe needs besides the leftover itself. */
  otherIngredients: string[]
  totalCount: number
}

/**
 * The inverse of the pantry search: not "here is everything I have, what can
 * I make?" but "this one thing is going off tonight, what uses it?"
 *
 * Coverage ranking would be wrong here. The pantry search scores a recipe by
 * how much of it the user already has, because they are shopping for nothing;
 * a leftover lookup assumes a shop is fine and asks only how much effort the
 * recipe adds. So the shortest ingredient list wins: ricotta on toast beats
 * lasagne when the ricotta is what needs eating.
 */
export async function recipesUsing(name: string): Promise<LeftoverMatch[]> {
  const wanted = normalizeIngredientName(name)
  if (wanted === '') return []

  // Aliases are resolved rather than ignored: the user types what is on the
  // tub, and a recipe saved under the canonical name should still be found.
  const alias = await db.ingredientAlias.findUnique({
    where: { alias: wanted },
    include: { ingredient: true },
  })
  const canonical = alias?.ingredient.name ?? wanted

  const recipes = await db.recipe.findMany({
    where: { ingredients: { some: { ingredient: { name: canonical } } } },
    include: { ingredients: { include: { ingredient: true } } },
  })

  const matches = recipes.map((recipe) => ({
    recipeId: recipe.id,
    title: recipe.title,
    otherIngredients: recipe.ingredients
      .map((row) => row.ingredient.name)
      .filter((ingredient) => ingredient !== canonical),
    totalCount: recipe.ingredients.length,
  }))

  // Ties break on title so the list is stable between renders; a leftover is
  // looked up repeatedly over a couple of days and a shuffling list reads as
  // if the answer changed.
  matches.sort(
    (a, b) => a.totalCount - b.totalCount || a.title.localeCompare(b.title),
  )
  return matches
}

export interface LeftoverSuggestion {
  name: string
  recipeCount: number
}

/**
 * Ingredients worth looking up, most useful first.
 *
 * The page needs something to offer before the user has typed anything, and
 * an alphabetical dump of every ingredient ever saved is not it. Only names
 * used by two or more recipes qualify: a one-off can only ever return the
 * single recipe it came from, which is not an answer to "what else uses this?"
 */
export async function suggestLeftovers(limit: number): Promise<LeftoverSuggestion[]> {
  const ingredients = await db.ingredient.findMany({
    include: { _count: { select: { recipeIngredients: true } } },
  })

  return ingredients
    .map((ingredient) => ({
      name: ingredient.name,
      recipeCount: ingredient._count.recipeIngredients,
    }))
    .filter((row) => row.recipeCount > 1)
    .sort((a, b) => b.recipeCount - a.recipeCount || a.name.localeCompare(b.name))
    .slice(0, limit)
}
