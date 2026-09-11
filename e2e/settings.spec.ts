import { test, expect } from '@playwright/test'

// The split these tests exist to pin down: /settings is application
// configuration and /staples is food. They used to be one route, and the only
// thing keeping them apart now is that each page renders what belongs to it.

test('settings holds application configuration and no food', async ({ page }) => {
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'AI integration' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Backups' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Staples', exact: true })).toHaveCount(0)
})

test('staples holds the food curation and no configuration', async ({ page }) => {
  await page.goto('/staples')

  await expect(page.getByRole('heading', { name: 'AI integration' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Backups' })).toHaveCount(0)
})

test('both pages are reachable from the nav', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })

  await nav.getByRole('link', { name: 'Staples' }).click()
  await expect(page).toHaveURL(/\/staples$/)

  await nav.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)
})

// The guarantee the whole feature rests on: a saved value is in effect for the
// next request, with no restart. Reloading is a fresh server render, so the
// value coming back proves it was actually persisted and re-read.
test('a changed backup interval survives a reload without a restart', async ({ page }) => {
  await page.goto('/settings')

  const interval = page.getByLabel('Back up every')
  await interval.fill('7')
  await page.getByRole('button', { name: 'Save' }).nth(1).click()
  await expect(page.getByText('Saved. Backups are scheduled from these values from now on.')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Back up every')).toHaveValue('7')

  // Put it back, since the e2e database persists across runs.
  await page.getByLabel('Back up every').fill('24')
  await page.getByRole('button', { name: 'Save' }).nth(1).click()
})
