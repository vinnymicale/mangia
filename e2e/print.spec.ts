import { test, expect, type APIRequestContext } from '@playwright/test'

// The e2e database persists across runs, so every title carries a suffix to
// keep locators unambiguous no matter what else has been seeded.
async function seedRecipe(request: APIRequestContext, title: string) {
  const response = await request.post('/api/recipes', {
    data: {
      title,
      instructions: 'Boil the water.\n\nSalt it well.',
      ingredients: [
        { quantity: 500, unit: 'gram', ingredient: 'spaghetti', rawText: '500 g spaghetti' },
      ],
      tags: [],
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).id as string
}

test('reaches the kitchen card from a recipe and shows the whole method', async ({
  page,
  request,
}) => {
  const suffix = `print-${Date.now()}`
  const title = `Cacio e Pepe ${suffix}`
  const id = await seedRecipe(request, title)

  await page.goto(`/recipes/${id}`)
  await page.getByRole('link', { name: 'Print' }).click()

  await expect(page).toHaveURL(`/recipes/${id}/print`)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  // Ingredients and method both have to be on the card: the point of paper is
  // that the cook stops needing the screen at all.
  await expect(page.getByRole('listitem').filter({ hasText: 'spaghetti' })).toBeVisible()
  await expect(page.getByText('Boil the water.')).toBeVisible()
  await expect(page.getByText('Salt it well.')).toBeVisible()
})

test('offers a print button on the kitchen card but keeps it off the paper', async ({
  page,
  request,
}) => {
  const suffix = `printbtn-${Date.now()}`
  const id = await seedRecipe(request, `Amatriciana ${suffix}`)

  await page.goto(`/recipes/${id}/print`)
  const button = page.getByRole('button', { name: 'Print' })
  await expect(button).toBeVisible()
  // The button lives inside a print:hidden wrapper: on screen it is the way to
  // reach the dialog, and on paper it is chrome the printer should never see.
  await expect(
    page.locator('.print\\:hidden').filter({ has: button }),
  ).toHaveCount(1)
})
