import { test, expect } from '@playwright/test'

async function createRecipe(request: import('@playwright/test').APIRequestContext) {
  const response = await request.post('/api/recipes', {
    data: {
      title: 'Cacio e Pepe',
      instructions: 'Boil the pasta.\n\nToss with cheese and pepper.',
      servings: 2,
      prepMinutes: 5,
      cookMinutes: 10,
      ingredients: [
        { quantity: 200, unit: 'gram', ingredient: 'spaghetti', rawText: '200 g spaghetti' },
        { quantity: 1, unit: 'cup', ingredient: 'pecorino', rawText: '1 cup pecorino' },
      ],
      tags: ['weeknight'],
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).id as string
}

test('shows a recipe detail page', async ({ page, request }) => {
  const id = await createRecipe(request)
  await page.goto(`/recipes/${id}`)
  await expect(page.getByRole('heading', { name: 'Cacio e Pepe' })).toBeVisible()
  await expect(page.getByText('spaghetti')).toBeVisible()
  await expect(page.getByText('weeknight')).toBeVisible()
})

test('cooking view splits the instructions into checkable steps', async ({ page, request }) => {
  const id = await createRecipe(request)
  await page.goto(`/recipes/${id}/cook`)
  const steps = page.getByRole('list').filter({ hasText: 'Boil the pasta.' })
  await expect(page.getByText('Boil the pasta.')).toBeVisible()
  await expect(page.getByText('Toss with cheese and pepper.')).toBeVisible()
  await steps.getByRole('checkbox').first().check()
  await expect(steps.getByRole('checkbox').first()).toBeChecked()
})

test('edits a recipe title', async ({ page, request }) => {
  const id = await createRecipe(request)
  await page.goto(`/recipes/${id}/edit`)
  await page.getByLabel('Title').fill('Cacio e Pepe (better)')
  await page.getByRole('button', { name: /save recipe|confirm and save/i }).click()
  await expect(page.getByRole('heading', { name: 'Cacio e Pepe (better)' })).toBeVisible()
})

test('returns 404 for a missing recipe', async ({ page }) => {
  const response = await page.goto('/recipes/does-not-exist')
  expect(response?.status()).toBe(404)
})
