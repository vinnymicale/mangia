import { test, expect } from '@playwright/test'

// The empty-state branch is not asserted here: other specs seed the shared e2e
// database, so "no recipes exist" is not a condition this suite can guarantee.
test('navigates to the add-recipe page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL(/\/recipes\/new/)
})

test('main navigation is present', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Recipes' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Lists' })).toBeVisible()
})
