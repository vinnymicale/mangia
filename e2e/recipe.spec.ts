import { test, expect } from '@playwright/test'

async function createRecipe(
  request: import('@playwright/test').APIRequestContext,
  title = 'Cacio e Pepe',
) {
  const response = await request.post('/api/recipes', {
    data: {
      title,
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

test('deletes a recipe after confirming and returns to the index', async ({ page, request }) => {
  const title = `Doomed Dish ${Date.now()}`
  const id = await createRecipe(request, title)

  await page.goto(`/recipes/${id}`)
  // The first click only arms the control; the page must stay put, since the
  // confirmation exists precisely so a stray click is not destructive.
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  await page.getByRole('button', { name: 'Delete recipe' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByText(title)).toHaveCount(0)

  // The recipe is really gone, not just missing from the refreshed index.
  const response = await request.get(`/api/recipes/${id}`)
  expect(response.status()).toBe(404)
})
