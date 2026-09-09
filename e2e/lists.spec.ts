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
