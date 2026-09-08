import { test, expect } from '@playwright/test'

test('parses a pasted ingredient blob into editable rows', async ({ page }) => {
  await page.goto('/recipes/new')
  await page.getByLabel('Ingredient list').fill('2 cups flour\n1 tsp salt\na glug of olive oil')
  await page.getByRole('button', { name: 'Parse ingredients' }).click()

  await expect(page.getByLabel('Ingredient for line 1')).toHaveValue('flour')
  await expect(page.getByLabel('Quantity for line 1')).toHaveValue('2')
  await expect(page.getByLabel('Ingredient for line 3')).toBeVisible()
  await expect(page.getByRole('button', { name: /clean up/i })).toBeVisible()
})

test('saves a typed recipe end to end', async ({ page }) => {
  await page.goto('/recipes/new')
  await page.getByRole('button', { name: /type it out/i }).click()
  await page.getByLabel('Title').fill('Test Pasta')
  await page.getByRole('button', { name: 'Add ingredient' }).click()
  await page.getByLabel('Quantity for line 1').fill('200')
  await page.getByLabel('Unit for line 1').fill('g')
  await page.getByLabel('Ingredient for line 1').fill('spaghetti')
  await page.getByLabel('Instructions').fill('Boil it.')

  await page.getByRole('button', { name: 'Save recipe' }).click()
  // First save surfaces the unknown-ingredient confirmation.
  await expect(page.getByText('New to your library')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm and save' }).click()

  await expect(page.getByRole('heading', { name: 'Test Pasta' })).toBeVisible()
})
