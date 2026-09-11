import { test, expect, type APIRequestContext } from '@playwright/test'

// The e2e database persists across runs, and the staples page lists every tag
// that has ever been seeded. Each test therefore uses its own suffixed tag
// names so getByRole stays unambiguous no matter what else has run.
async function seedTagged(request: APIRequestContext, title: string, tags: string[]) {
  const response = await request.post('/api/recipes', {
    data: { title, instructions: 'Cook it.', ingredients: [], tags },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).id as string
}

test('renames a tag from the staples page', async ({ page, request }) => {
  const suffix = `rename-${Date.now()}`
  await seedTagged(request, `Ragu ${suffix}`, [`sunday-${suffix}`])

  await page.goto('/staples')
  await page.getByRole('button', { name: `Rename sunday-${suffix}` }).click()
  const input = page.getByRole('textbox', { name: `Rename sunday-${suffix}` })
  await input.fill(`weekend-${suffix}`)
  await page.getByRole('button', { name: `Save sunday-${suffix}` }).click()

  await expect(page.getByText(`weekend-${suffix}`)).toBeVisible()
  await expect(page.getByText(`sunday-${suffix}`, { exact: true })).toHaveCount(0)
})

test('merges a tag when renamed onto one that already exists', async ({ page, request }) => {
  const suffix = `merge-${Date.now()}`
  const from = `stew-${suffix}`
  const to = `braise-${suffix}`
  await seedTagged(request, `Osso Buco ${suffix}`, [from])
  await seedTagged(request, `Short Rib ${suffix}`, [to])

  await page.goto('/staples')
  await page.getByRole('button', { name: `Rename ${from}` }).click()
  await page.getByRole('textbox', { name: `Rename ${from}` }).fill(to)
  await page.getByRole('button', { name: `Save ${from}` }).click()

  // The merge is the surprising outcome, so the page has to say it happened.
  await expect(page.getByRole('status')).toContainText('Merged')
  await expect(page.getByText(from, { exact: true })).toHaveCount(0)
  await expect(page.getByText(`${to}`, { exact: true })).toBeVisible()
})

test('deletes a tag after confirming, leaving the recipe', async ({ page, request }) => {
  const suffix = `delete-${Date.now()}`
  const tag = `spicy-${suffix}`
  const id = await seedTagged(request, `Vindaloo ${suffix}`, [tag])

  await page.goto('/staples')
  await page.getByRole('button', { name: `Delete ${tag}` }).click()
  // Arming alone must not delete: the confirm step is the whole point.
  await expect(page.getByText(tag, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete tag' }).click()

  await expect(page.getByText(tag, { exact: true })).toHaveCount(0)
  const recipe = await request.get(`/api/recipes/${id}`)
  expect(recipe.status()).toBe(200)
})

test('files a tag under a kind and keeps it after a reload', async ({ page, request }) => {
  const suffix = `kind-${Date.now()}`
  const tag = `napoli-${suffix}`
  await seedTagged(request, `Pizza ${suffix}`, [tag])

  await page.goto('/staples')
  const select = page.getByRole('combobox', { name: `Kind of ${tag}` })
  // Every tag starts in the pile the schema default puts it in.
  await expect(select).toHaveValue('freeform')
  await select.selectOption('cuisine')

  // A reload is the assertion that matters: the select is optimistic, so only
  // a fresh server render proves the classification actually persisted.
  await page.reload()
  await expect(page.getByRole('combobox', { name: `Kind of ${tag}` })).toHaveValue('cuisine')
})
