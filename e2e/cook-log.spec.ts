import { test, expect, type APIRequestContext } from '@playwright/test'

// The e2e database persists across runs and the diary lists every cook ever
// recorded, so each test suffixes its titles to keep locators unambiguous.
async function seedRecipe(request: APIRequestContext, title: string) {
  const response = await request.post('/api/recipes', {
    data: {
      title,
      instructions: 'Cook it.',
      ingredients: [
        { quantity: 1, unit: null, ingredient: 'butter', rawText: '1 butter' },
      ],
      tags: [],
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).id as string
}

test('records a cook from the recipe page and keeps it in the history', async ({
  page,
  request,
}) => {
  const suffix = `log-${Date.now()}`
  const id = await seedRecipe(request, `Carbonara ${suffix}`)

  await page.goto(`/recipes/${id}`)
  await page.getByRole('button', { name: 'Log a cook' }).click()

  // A single cook is history, not just a timestamp: the entry has to survive
  // a reload, which is the whole point of a log over lastCookedAt.
  const history = page.getByRole('region', { name: 'Cooking history' })
  await expect(history.getByRole('listitem')).toHaveCount(1)
  await page.reload()
  await expect(
    page.getByRole('region', { name: 'Cooking history' }).getByRole('listitem'),
  ).toHaveCount(1)
})

test('counts repeat cooks rather than overwriting the last one', async ({
  page,
  request,
}) => {
  const suffix = `repeat-${Date.now()}`
  const id = await seedRecipe(request, `Ragu ${suffix}`)

  // Two cooks on different days: the question lastCookedAt could never answer.
  for (const cookedAt of ['2026-01-05T18:00:00.000Z', '2026-02-05T18:00:00.000Z']) {
    const response = await request.post(`/api/recipes/${id}/cook-log`, {
      data: { cookedAt },
    })
    expect(response.ok()).toBe(true)
  }

  await page.goto(`/recipes/${id}`)
  await expect(
    page.getByRole('region', { name: 'Cooking history' }).getByRole('listitem'),
  ).toHaveCount(2)
})

test('removes a single entry without losing the rest of the history', async ({
  page,
  request,
}) => {
  const suffix = `del-${Date.now()}`
  const id = await seedRecipe(request, `Puttanesca ${suffix}`)
  for (const cookedAt of ['2026-03-01T18:00:00.000Z', '2026-03-08T18:00:00.000Z']) {
    await request.post(`/api/recipes/${id}/cook-log`, { data: { cookedAt } })
  }

  await page.goto(`/recipes/${id}`)
  const history = page.getByRole('region', { name: 'Cooking history' })
  await expect(history.getByRole('listitem')).toHaveCount(2)

  await history.getByRole('button', { name: /^Remove/ }).first().click()
  await expect(history.getByRole('listitem')).toHaveCount(1)
})

test('shows the kitchen diary with every recipe interleaved', async ({
  page,
  request,
}) => {
  const suffix = `diary-${Date.now()}`
  const title = `Osso Buco ${suffix}`
  const id = await seedRecipe(request, title)
  await request.post(`/api/recipes/${id}/cook-log`, {
    data: { cookedAt: '2026-04-02T18:00:00.000Z', note: `note-${suffix}` },
  })

  await page.goto('/diary')
  await expect(page.getByRole('heading', { name: 'Kitchen Diary' })).toBeVisible()
  // The diary is the cross-recipe view: the recipe's name and the note the
  // cook left both have to survive the trip.
  const recent = page.getByRole('region', { name: 'Recent cooks' })
  await expect(recent.getByRole('link', { name: title })).toBeVisible()
  await expect(recent.getByText(`note-${suffix}`)).toBeVisible()
})
