import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

// FoodData Central is the stub in fixtures/usda-stub.mjs: it matches nothing,
// and answers 503 to any search containing "offline". Ingredient nutrition is
// shared across recipes and the e2e database persists, so every ingredient
// name carries a suffix to start each run from nothing.
async function seedRecipe(
  request: APIRequestContext,
  title: string,
  ingredient: string,
  grams: number,
) {
  const response = await request.post('/api/recipes', {
    data: {
      title,
      servings: 2,
      instructions: 'Cook it.',
      ingredients: [
        { quantity: grams, unit: 'gram', ingredient, rawText: `${grams} g ${ingredient}` },
      ],
      tags: [],
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).id as string
}

function nutritionPanel(page: Page) {
  return page.getByRole('region', { name: 'Nutrition' })
}

/** The per-serving figure beside a label in the panel's summary. */
function figure(page: Page, label: string) {
  return nutritionPanel(page).locator('dl > div').filter({ hasText: label }).locator('dd')
}

test('says so when FoodData Central cannot be reached', async ({ page, request }) => {
  const suffix = `${Date.now()}`
  const id = await seedRecipe(request, `Brodo ${suffix}`, `offline stock ${suffix}`, 500)

  await page.goto(`/recipes/${id}`)

  await expect(nutritionPanel(page).getByText('FoodData Central could not be reached')).toBeVisible()
  // Not marked unmatched: the next visit should try the lookup again.
  await nutritionPanel(page).getByText('Breakdown').click()
  await expect(nutritionPanel(page).getByText('Not looked up')).toBeVisible()
})

test('fills a missing ingredient by hand and updates the totals', async ({ page, request }) => {
  const suffix = `${Date.now()}`
  const id = await seedRecipe(request, `Polenta ${suffix}`, `cornmeal ${suffix}`, 200)

  await page.goto(`/recipes/${id}`)
  const panel = nutritionPanel(page)
  await panel.getByRole('button', { name: '1 ingredient needs input' }).click()

  await expect(panel.getByText(`Nutrition for cornmeal ${suffix}`)).toBeVisible()
  await panel.getByLabel('Calories (kcal)').fill('360')
  await panel.getByLabel('Protein (g)').fill('8')
  await panel.getByRole('button', { name: 'Save', exact: true }).click()

  // 200 g at 360 kcal per 100 g, over 2 servings.
  await expect(figure(page, 'Calories')).toHaveText('360 kcal')
  await expect(figure(page, 'Protein')).toHaveText('8 g')
  await expect(panel.getByText('Estimate covers 1 of 1 ingredients')).toBeVisible()
  await expect(panel.getByRole('button', { name: /needs input/ })).toHaveCount(0)
})

test('an edit on the ingredients page reaches every recipe using it', async ({ page, request }) => {
  const suffix = `${Date.now()}`
  const name = `farro ${suffix}`
  const id = await seedRecipe(request, `Farrotto ${suffix}`, name, 100)

  await page.goto('/ingredients')
  await page.getByRole('searchbox', { name: 'Search ingredients' }).fill(name)
  await page.getByRole('button', { name }).click()
  await page.getByLabel('Calories (kcal)').fill('340')
  await page.getByLabel('Fat (g)').fill('2.5')
  await page.getByRole('button', { name: 'Save values' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  await page.goto(`/recipes/${id}`)
  // 100 g over 2 servings.
  await expect(figure(page, 'Calories')).toHaveText('170 kcal')
  await expect(figure(page, 'Fat')).toHaveText('1.3 g')
})

test('sets and clears a hand-entered override', async ({ page, request }) => {
  const suffix = `${Date.now()}`
  const id = await seedRecipe(request, `Ribollita ${suffix}`, `cavolo nero ${suffix}`, 300)

  await page.goto(`/recipes/${id}`)
  const panel = nutritionPanel(page)
  // Let the automatic lookup settle so it cannot land after the override.
  await expect(panel.getByRole('button', { name: '1 ingredient needs input' })).toBeVisible()

  await panel.getByRole('button', { name: 'Override' }).click()
  await panel.getByLabel('Calories (kcal)').fill('640')
  await panel.getByLabel('Protein (g)').fill('38')
  await panel.getByLabel('Note').fill('From the back of the book')
  await panel.getByRole('button', { name: 'Save override' }).click()

  await expect(figure(page, 'Calories')).toHaveText('640 kcal')
  await expect(panel.getByText('From the back of the book')).toBeVisible()

  // It survives a reload: the override is stored, not just shown.
  await page.reload()
  await expect(figure(page, 'Calories')).toHaveText('640 kcal')

  await panel.getByRole('button', { name: 'Override' }).click()
  await panel.getByRole('button', { name: 'Clear override' }).click()
  await expect(panel.getByText('From the back of the book')).toHaveCount(0)
  await expect(panel.getByText('No estimate yet.')).toBeVisible()
})
