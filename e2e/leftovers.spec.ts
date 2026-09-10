import { test, expect, type APIRequestContext } from '@playwright/test'

async function seedRecipe(
  request: APIRequestContext,
  title: string,
  names: string[],
) {
  const response = await request.post('/api/recipes', {
    data: {
      title,
      instructions: 'Cook it.',
      ingredients: names.map((ingredient) => ({
        quantity: 1, unit: null, ingredient, rawText: `1 ${ingredient}`,
      })),
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).id as string
}

test('looks up what a leftover ingredient can be used in', async ({ page, request }) => {
  const suffix = `left-${Date.now()}`
  const leftover = `ricotta-${suffix}`
  await seedRecipe(request, `Toast ${suffix}`, [`bread-${suffix}`, leftover])
  await seedRecipe(request, `Lasagne ${suffix}`, [
    leftover, `pasta-${suffix}`, `beef-${suffix}`, `tomato-${suffix}`,
  ])

  await page.goto('/leftovers')
  await page.getByRole('searchbox', { name: 'Leftover ingredient' }).fill(leftover)
  await page.getByRole('button', { name: 'What uses it?' }).click()

  const results = page.getByRole('region', { name: 'Recipes using this' })
  await expect(results.getByRole('link', { name: `Toast ${suffix}` })).toBeVisible()
  await expect(results.getByRole('link', { name: `Lasagne ${suffix}` })).toBeVisible()

  // The shortest ingredient list comes first: a leftover is a thing to use up
  // tonight, so the recipe that asks least of the cook is the best answer.
  const titles = await results.getByRole('listitem').allInnerTexts()
  expect(titles[0]).toContain(`Toast ${suffix}`)
})

test('says so plainly when nothing uses the ingredient', async ({ page }) => {
  await page.goto('/leftovers')
  await page
    .getByRole('searchbox', { name: 'Leftover ingredient' })
    .fill(`nothing-uses-this-${Date.now()}`)
  await page.getByRole('button', { name: 'What uses it?' }).click()

  await expect(page.getByText('No recipe calls for that.')).toBeVisible()
})

test('reaches the leftovers lookup from the pantry search', async ({ page }) => {
  await page.goto('/pantry')
  await page.getByRole('link', { name: 'Find what uses it up' }).click()
  await expect(page).toHaveURL('/leftovers')
  await expect(page.getByRole('heading', { name: 'Use it up' })).toBeVisible()
})
