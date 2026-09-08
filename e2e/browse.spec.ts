import { test, expect, type APIRequestContext } from '@playwright/test'

// The e2e database persists across runs and across tests in a run, so every
// test seeds a uniquely-titled pair under its own tag. Sharing fixture titles
// makes getByRole strict-mode-ambiguous as soon as a second test seeds, and the
// tag is what scopes the browse page back down to just this test's rows.
async function seed(request: APIRequestContext, suffix: string) {
  await request.post('/api/recipes', {
    data: {
      title: `Carbonara ${suffix}`,
      instructions: 'Render the guanciale.',
      prepMinutes: 10, cookMinutes: 15,
      ingredients: [
        { quantity: 2, unit: null, ingredient: 'eggs', rawText: '2 eggs' },
        { quantity: 100, unit: 'gram', ingredient: 'pecorino', rawText: '100 g pecorino' },
        { quantity: 200, unit: 'gram', ingredient: 'spaghetti', rawText: '200 g spaghetti' },
      ],
      tags: [suffix],
    },
  })
  await request.post('/api/recipes', {
    data: {
      title: `Beef Bourguignon ${suffix}`,
      instructions: 'Brown the beef.',
      prepMinutes: 30, cookMinutes: 180,
      ingredients: [{ quantity: 1, unit: 'kilogram', ingredient: 'beef chuck', rawText: '1 kg beef chuck' }],
      tags: [suffix],
    },
  })
}

test('sorts recipes by total time', async ({ page, request }) => {
  const id = `sort-${Date.now()}`
  await seed(request, id)
  await page.goto(`/?sort=time&tag=${id}`)
  const titles = page.getByRole('heading', { level: 2 })
  await expect(titles.first()).toHaveText(`Carbonara ${id}`)
})

test('filters by max minutes', async ({ page, request }) => {
  const id = `max-${Date.now()}`
  await seed(request, id)
  await page.goto(`/?maxMinutes=60&tag=${id}`)
  await expect(page.getByRole('heading', { name: `Carbonara ${id}` })).toBeVisible()
  await expect(page.getByRole('heading', { name: `Beef Bourguignon ${id}` })).toHaveCount(0)
})

test('full-text search finds a recipe by title', async ({ page, request }) => {
  const id = `fts-${Date.now()}`
  await seed(request, id)
  await page.goto(`/search?q=${id}`)
  await expect(page.getByRole('heading', { name: `Carbonara ${id}` })).toBeVisible()
})

test('ingredients-on-hand search shows coverage and misses', async ({ page, request }) => {
  const id = `hand-${Date.now()}`
  await seed(request, id)
  await page.goto('/search')
  await page.getByLabel('Ingredients on hand').fill('eggs, spaghetti')
  await page.getByRole('button', { name: 'What can I make?' }).click()
  await expect(page.getByRole('heading', { name: `Carbonara ${id}` })).toBeVisible()
  await expect(page.getByText(/Missing: pecorino/).first()).toBeVisible()
})
