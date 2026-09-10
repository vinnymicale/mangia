import { test, expect, type APIRequestContext } from '@playwright/test'

// The e2e database persists across runs and across tests in a run, so each test
// seeds uniquely-titled recipes. Shared titles like a bare "Pancakes" become
// strict-mode-ambiguous on the second run, and the /lists picker renders every
// recipe every other spec has ever seeded.
async function seed(request: APIRequestContext, suffix: string) {
  const a = await request.post('/api/recipes', {
    data: {
      title: `Pancakes ${suffix}`,
      instructions: 'Mix and fry.',
      ingredients: [
        { quantity: 2, unit: 'cup', ingredient: `flour ${suffix}`, rawText: '2 cups flour' },
        { quantity: 1, unit: 'cup', ingredient: `milk ${suffix}`, rawText: '1 cup milk' },
      ],
      tags: [suffix],
    },
  })
  const b = await request.post('/api/recipes', {
    data: {
      title: `Waffles ${suffix}`,
      instructions: 'Mix and press.',
      ingredients: [
        { quantity: 4, unit: 'tablespoon', ingredient: `flour ${suffix}`, rawText: '4 tbsp flour' },
      ],
      tags: [suffix],
    },
  })
  return [(await a.json()).id as string, (await b.json()).id as string]
}

test('merges compatible quantities across recipes', async ({ page, request }) => {
  const id = `merge-${Date.now()}`
  await seed(request, id)
  await page.goto('/lists')
  await page.getByLabel(`Pancakes ${id}`).check()
  await page.getByLabel(`Waffles ${id}`).check()
  await page.getByRole('button', { name: /Make a list from 2 recipes/ }).click()

  // 2 cups + 4 tbsp = 2.25 cups, attributed to both recipes. Asserted on the
  // row rather than one text node: the measure sits in its own column, so the
  // quantity and the name are siblings rather than one string.
  const merged = page.getByRole('listitem').filter({ hasText: `flour ${id}` })
  await expect(merged).toContainText('2.25 cup')
  await expect(
    page.getByText(new RegExp(`for Pancakes ${id}, Waffles ${id}|for Waffles ${id}, Pancakes ${id}`)),
  ).toBeVisible()
})

test('checks off and adds items', async ({ page, request }) => {
  const id = `check-${Date.now()}`
  const [recipeId] = await seed(request, id)
  const response = await request.post('/api/lists', { data: { recipeIds: [recipeId] } })
  const listId = (await response.json()).id as string

  await page.goto(`/lists/${listId}`)
  await page.getByRole('checkbox').first().check()
  await expect(page.getByRole('checkbox').first()).toBeChecked()

  await page.getByLabel('Add an item').fill(`paper towels ${id}`)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(`paper towels ${id}`)).toBeVisible()

  // The checked state survives a reload.
  await page.reload()
  await expect(page.getByRole('checkbox').first()).toBeChecked()
})

test('shows progress and clears the checked items', async ({ page, request }) => {
  const id = `clear-${Date.now()}`
  const [recipeId] = await seed(request, id)
  const response = await request.post('/api/lists', { data: { recipeIds: [recipeId] } })
  const listId = (await response.json()).id as string

  await page.goto(`/lists/${listId}`)
  const before = await page.getByRole('checkbox').count()
  await expect(page.getByRole('status')).toHaveText(`0 of ${before} in the basket`)

  await page.getByRole('checkbox').first().check()
  await expect(page.getByRole('status')).toHaveText(`1 of ${before} in the basket`)

  await page.getByRole('button', { name: 'Clear 1 checked' }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(before - 1)
  await expect(page.getByRole('status')).toHaveText(`0 of ${before - 1} in the basket`)

  // The removal is real, not just local state.
  await page.reload()
  await expect(page.getByRole('checkbox')).toHaveCount(before - 1)
})

test('deletes a list from the index after confirming', async ({ page, request }) => {
  const id = `del-${Date.now()}`
  const [recipeId] = await seed(request, id)
  const response = await request.post('/api/lists', {
    data: { recipeIds: [recipeId], name: `Doomed ${id}` },
  })
  const listId = (await response.json()).id as string

  await page.goto('/lists')
  const row = page.getByRole('listitem').filter({ hasText: `Doomed ${id}` })
  await expect(row).toBeVisible()

  // The first click only arms the control -- the row must survive it, since
  // that is the whole point of asking before deleting.
  await row.getByRole('button', { name: `Delete Doomed ${id}` }).click()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Delete list' }).click()

  await expect(row).toHaveCount(0)
  // Gone from the server too, not just from the client cache.
  await page.reload()
  await expect(page.getByText(`Doomed ${id}`)).toHaveCount(0)
})

test('keeps a list when the confirmation is cancelled', async ({ page, request }) => {
  const id = `keep-${Date.now()}`
  const [recipeId] = await seed(request, id)
  const response = await request.post('/api/lists', {
    data: { recipeIds: [recipeId], name: `Spared ${id}` },
  })
  await response.json()

  await page.goto('/lists')
  const row = page.getByRole('listitem').filter({ hasText: `Spared ${id}` })
  await row.getByRole('button', { name: `Delete Spared ${id}` }).click()
  await row.getByRole('button', { name: 'Cancel' }).click()

  await page.reload()
  await expect(page.getByText(`Spared ${id}`)).toBeVisible()
})
