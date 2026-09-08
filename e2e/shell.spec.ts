import { test, expect } from '@playwright/test'

test('shows the empty state on a fresh install', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'No recipes yet' })).toBeVisible()
})

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
