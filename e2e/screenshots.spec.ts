import { test, expect, type APIRequestContext } from '@playwright/test'
import { mkdirSync } from 'node:fs'

// Not part of the default e2e run -- `npm run screenshots` points Playwright at
// this file on its own. It seeds a fixed set of mock recipes and captures the
// README images, so the shots stay reproducible rather than depending on
// whatever happens to be in the database.

const OUT = 'docs/screenshots'
const VIEWPORT = { width: 1280, height: 900 }

const RECIPES = [
  {
    title: 'Weeknight Turkey Chili',
    description: 'A thick, forgiving chili that gets better on the second day.',
    instructions:
      'Brown the turkey with the onion and pepper.\nStir in the chili powder and cumin, then the tomatoes and beans.\nSimmer 25 minutes, uncovered, until it thickens.\nTaste for salt and finish with lime.',
    servings: 6, prepMinutes: 15, cookMinutes: 35,
    tags: ['weeknight', 'one pot'],
    ingredients: [
      { quantity: 1, unit: 'pound', ingredient: 'ground turkey', rawText: '1 lb ground turkey' },
      { quantity: 1, unit: null, ingredient: 'yellow onion', note: 'diced', rawText: '1 yellow onion, diced' },
      { quantity: 1, unit: null, ingredient: 'red bell pepper', note: 'diced', rawText: '1 red bell pepper, diced' },
      { quantity: 2, unit: 'tablespoon', ingredient: 'chili powder', rawText: '2 tbsp chili powder' },
      { quantity: 1, unit: 'teaspoon', ingredient: 'ground cumin', rawText: '1 tsp ground cumin' },
      { quantity: 28, unit: 'ounce', ingredient: 'crushed tomatoes', rawText: '28 oz crushed tomatoes' },
      { quantity: 15, unit: 'ounce', ingredient: 'kidney beans', note: 'drained', rawText: '15 oz kidney beans, drained' },
      { quantity: 1, unit: null, ingredient: 'lime', rawText: '1 lime' },
    ],
  },
  {
    title: 'Garlic Ginger Chicken Stir Fry',
    description: 'Everything prepped before the wok goes on, then dinner in twelve minutes.',
    instructions:
      'Slice the chicken thin and toss with cornstarch.\nGet the wok ripping hot, sear the chicken, set it aside.\nStir fry the broccoli and carrot 3 minutes.\nReturn the chicken, add the sauce, toss until glossy.',
    servings: 4, prepMinutes: 20, cookMinutes: 12,
    tags: ['weeknight', 'stir fry'],
    ingredients: [
      { quantity: 1.5, unit: 'pound', ingredient: 'chicken thighs', rawText: '1 1/2 lb boneless chicken thighs' },
      { quantity: 2, unit: 'tablespoon', ingredient: 'cornstarch', rawText: '2 tbsp cornstarch' },
      { quantity: 4, unit: 'clove', ingredient: 'garlic', note: 'minced', rawText: '4 cloves garlic, minced' },
      { quantity: 1, unit: 'tablespoon', ingredient: 'fresh ginger', note: 'grated', rawText: '1 tbsp fresh ginger, grated' },
      { quantity: 3, unit: 'cup', ingredient: 'broccoli florets', rawText: '3 cups broccoli florets' },
      { quantity: 1, unit: null, ingredient: 'carrot', note: 'sliced on a bias', rawText: '1 carrot, sliced on a bias' },
      { quantity: 3, unit: 'tablespoon', ingredient: 'soy sauce', rawText: '3 tbsp soy sauce' },
      { quantity: 1, unit: 'tablespoon', ingredient: 'toasted sesame oil', rawText: '1 tbsp toasted sesame oil' },
    ],
  },
  {
    title: 'Buttermilk Pancakes',
    description: 'Tall, tangy, and worth resting the batter for.',
    instructions:
      'Whisk the dry ingredients.\nWhisk the wet separately, then fold together -- lumps are fine.\nRest the batter 10 minutes.\nGriddle over medium until the bubbles set, then flip.',
    servings: 4, prepMinutes: 10, cookMinutes: 15,
    tags: ['breakfast'],
    ingredients: [
      { quantity: 2, unit: 'cup', ingredient: 'all-purpose flour', rawText: '2 cups all-purpose flour' },
      { quantity: 2, unit: 'tablespoon', ingredient: 'sugar', rawText: '2 tbsp sugar' },
      { quantity: 2, unit: 'teaspoon', ingredient: 'baking powder', rawText: '2 tsp baking powder' },
      { quantity: 0.5, unit: 'teaspoon', ingredient: 'baking soda', rawText: '1/2 tsp baking soda' },
      { quantity: 2, unit: 'cup', ingredient: 'buttermilk', rawText: '2 cups buttermilk' },
      { quantity: 2, unit: null, ingredient: 'eggs', rawText: '2 eggs' },
      { quantity: 4, unit: 'tablespoon', ingredient: 'butter', note: 'melted', rawText: '4 tbsp butter, melted' },
    ],
  },
  {
    title: 'Sheet Pan Salmon and Potatoes',
    description: 'The potatoes get a head start so everything finishes together.',
    instructions:
      'Roast the halved potatoes at 425F for 20 minutes.\nPush them aside, add the salmon and asparagus.\nRoast 12 more minutes until the salmon flakes.\nFinish with lemon and dill.',
    servings: 4, prepMinutes: 10, cookMinutes: 32,
    tags: ['weeknight', 'sheet pan'],
    ingredients: [
      { quantity: 4, unit: null, ingredient: 'salmon fillets', rawText: '4 salmon fillets' },
      { quantity: 1.5, unit: 'pound', ingredient: 'baby potatoes', note: 'halved', rawText: '1 1/2 lb baby potatoes, halved' },
      { quantity: 1, unit: 'bunch', ingredient: 'asparagus', note: 'trimmed', rawText: '1 bunch asparagus, trimmed' },
      { quantity: 3, unit: 'tablespoon', ingredient: 'olive oil', rawText: '3 tbsp olive oil' },
      { quantity: 1, unit: null, ingredient: 'lemon', rawText: '1 lemon' },
      { quantity: 2, unit: 'tablespoon', ingredient: 'fresh dill', rawText: '2 tbsp fresh dill' },
    ],
  },
  {
    title: 'Slow Cooker Pulled Pork',
    description: 'Eight hours of nothing, then pork that shreds with a fork.',
    instructions:
      'Rub the shoulder with the spice mix the night before.\nSet it on the onions with the vinegar and stock.\nLow for 8 hours, until it shreds against the spoon.\nSkim the fat, shred, and toss with the reduced juices.',
    servings: 8, prepMinutes: 20, cookMinutes: 480,
    tags: ['slow cooker', 'weekend'],
    ingredients: [
      { quantity: 4, unit: 'pound', ingredient: 'pork shoulder', rawText: '4 lb pork shoulder' },
      { quantity: 2, unit: 'tablespoon', ingredient: 'smoked paprika', rawText: '2 tbsp smoked paprika' },
      { quantity: 2, unit: 'tablespoon', ingredient: 'brown sugar', rawText: '2 tbsp brown sugar' },
      { quantity: 2, unit: null, ingredient: 'yellow onion', note: 'sliced', rawText: '2 yellow onions, sliced' },
      { quantity: 0.5, unit: 'cup', ingredient: 'apple cider vinegar', rawText: '1/2 cup apple cider vinegar' },
      { quantity: 1, unit: 'cup', ingredient: 'chicken stock', rawText: '1 cup chicken stock' },
    ],
  },
  {
    title: 'Tomato Basil Soup',
    description: 'Roasting the tomatoes first is the whole trick.',
    instructions:
      'Sweat the onion and garlic in butter until soft.\nAdd the tomatoes and stock, simmer 20 minutes.\nBlend smooth, then stir in the cream and torn basil.',
    servings: 4, prepMinutes: 10, cookMinutes: 30,
    tags: ['vegetarian', 'one pot'],
    ingredients: [
      { quantity: 2, unit: 'tablespoon', ingredient: 'butter', rawText: '2 tbsp butter' },
      { quantity: 1, unit: null, ingredient: 'yellow onion', note: 'chopped', rawText: '1 yellow onion, chopped' },
      { quantity: 3, unit: 'clove', ingredient: 'garlic', rawText: '3 cloves garlic' },
      { quantity: 28, unit: 'ounce', ingredient: 'whole peeled tomatoes', rawText: '28 oz whole peeled tomatoes' },
      { quantity: 2, unit: 'cup', ingredient: 'chicken stock', rawText: '2 cups chicken stock' },
      { quantity: 0.5, unit: 'cup', ingredient: 'heavy cream', rawText: '1/2 cup heavy cream' },
      { quantity: 1, unit: 'cup', ingredient: 'fresh basil', rawText: '1 cup fresh basil leaves' },
    ],
  },
]

async function seed(request: APIRequestContext): Promise<string[]> {
  const ids: string[] = []
  for (const recipe of RECIPES) {
    const res = await request.post('/api/recipes', { data: recipe })
    const body = await res.json()
    ids.push(body.id)
  }
  return ids
}

// The e2e FoodData Central stub knows no foods, so the stir fry's ingredients
// get USDA-like values per 100 g here, and a weight for each unit that is not
// already one. That gives the nutrition shot a complete estimate.
const STIR_FRY_NUTRITION: Record<string, { per100g: number[]; weight?: [string | null, number] }> = {
  //                     kcal protein carbs fat fiber sugar sodium
  'chicken thighs':    { per100g: [121, 19.7, 0, 4.1, 0, 0, 95] },
  cornstarch:          { per100g: [381, 0.3, 91, 0.1, 0.9, 0, 9], weight: ['tablespoon', 8] },
  garlic:              { per100g: [149, 6.4, 33, 0.5, 2.1, 1, 17], weight: ['clove', 3] },
  'fresh ginger':      { per100g: [80, 1.8, 18, 0.8, 2, 1.7, 13], weight: ['tablespoon', 6] },
  'broccoli florets':  { per100g: [34, 2.8, 6.6, 0.4, 2.6, 1.7, 33], weight: ['cup', 91] },
  carrot:              { per100g: [41, 0.9, 9.6, 0.2, 2.8, 4.7, 69], weight: [null, 61] },
  'soy sauce':         { per100g: [53, 8.1, 4.9, 0.6, 0.8, 0.4, 5493], weight: ['tablespoon', 16] },
  'toasted sesame oil': { per100g: [884, 0, 0, 100, 0, 0, 0], weight: ['tablespoon', 13.6] },
}

async function seedNutrition(request: APIRequestContext) {
  const res = await request.get('/api/ingredients')
  const { ingredients } = (await res.json()) as { ingredients: { id: string; name: string }[] }
  for (const [name, { per100g, weight }] of Object.entries(STIR_FRY_NUTRITION)) {
    const id = ingredients.find((row) => row.name === name)!.id
    const [kcal, protein, carbs, fat, fiber, sugar, sodium] = per100g
    await request.put(`/api/ingredients/${id}/nutrition`, {
      data: { nutrients: { kcal, protein, carbs, fat, fiber, sugar, sodium } },
    })
    if (weight) {
      await request.put(`/api/ingredients/${id}/weights`, {
        data: { unit: weight[0], grams: weight[1] },
      })
    }
  }
}

test.use({ viewport: VIEWPORT })

test('captures the README screenshots', async ({ page, request }) => {
  mkdirSync(OUT, { recursive: true })
  const ids = await seed(request)
  await seedNutrition(request)

  // Browse: the whole library, most recent first.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tomato Basil Soup' })).toBeVisible()
  await page.screenshot({ path: `${OUT}/browse.png`, caret: 'initial' })

  // A single recipe, the ingredients above the method.
  await page.goto(`/recipes/${ids[1]}`)
  await expect(page.getByRole('heading', { name: 'Garlic Ginger Chicken Stir Fry' })).toBeVisible()
  await expect(page.getByRole('term').filter({ hasText: 'Calories' })).toBeVisible()
  await page.screenshot({ path: `${OUT}/recipe.png`, caret: 'initial' })

  // The same recipe's nutrition, opened from the action row.
  await page.getByRole('button', { name: 'Nutrition', exact: true }).click()
  const nutrition = page.getByRole('dialog', { name: 'Nutrition' })
  await expect(nutrition.getByText('Estimate covers 8 of 8 ingredients')).toBeVisible()
  await nutrition.getByText('Breakdown').click()
  await page.screenshot({ path: `${OUT}/nutrition.png`, caret: 'initial' })

  // The paste-a-blob entry path, mid-review, with the parsed rows showing.
  await page.goto('/recipes/new')
  await page.getByLabel('Ingredient list').fill(
    '2 cups all-purpose flour\n1 1/2 lb chicken thighs\n3 tbsp soy sauce\n4 cloves garlic, minced\na generous glug of olive oil\nsalt to taste',
  )
  await page.getByRole('button', { name: 'Parse ingredients' }).click()
  await expect(page.getByLabel('Ingredient for line 1')).toHaveValue('all-purpose flour')
  await page.screenshot({ path: `${OUT}/entry.png`, caret: 'initial' })

  // Ingredients-on-hand search, showing coverage and what is missing.
  await page.goto('/pantry')
  await page.getByLabel('Ingredients on hand').fill(
    'chicken thighs, garlic, soy sauce, broccoli florets, carrot',
  )
  await page.getByRole('button', { name: 'What can I make?' }).click()
  await expect(page.getByRole('heading', { name: 'Garlic Ginger Chicken Stir Fry' })).toBeVisible()
  await page.screenshot({ path: `${OUT}/search.png`, caret: 'initial' })

  // A shopping list merged from three recipes.
  const listRes = await request.post('/api/lists', {
    data: { recipeIds: [ids[0], ids[3], ids[5]], name: 'This week' },
  })
  const { id: listId } = await listRes.json()
  await page.goto(`/lists/${listId}`)
  await page.screenshot({ path: `${OUT}/shopping-list.png`, caret: 'initial' })
})
