import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'recipe-card.png')

// A real OCR engine, not a stub: the worker downloads and boots a WASM heap
// and language data on first use, then reads a full card. Minutes, not seconds,
// on a cold cache. This is the one spec that proves the fallback path works
// against the actual engine rather than a mock of it.
test.setTimeout(180_000)

// The e2e server runs with no API key, so the importer finds no provider and
// takes the OCR branch. That is what makes this deterministic -- a vision model
// would put a different draft in the form on every run.
test('reads a recipe card with OCR and saves what the cook corrects', async ({ page }) => {
  await page.goto('/recipes/new')
  await page.getByRole('tab', { name: 'From a photo' }).click()
  await page.getByLabel('Recipe photo').setInputFiles(FIXTURE)
  await page.getByRole('button', { name: 'Read photo' }).click()

  // The form replaces the tabs once the read lands.
  await expect(page.getByLabel('Title')).toHaveValue(/Lemon Butter Beans/i, {
    timeout: 150_000,
  })

  // The card stays beside the parse, with what the engine actually read.
  await expect(page.getByAltText(/recipe photo this was read from/i)).toBeVisible()
  await expect(page.getByText('What was read')).toBeVisible()
  await expect(page.getByText(/on-device text recognition/i)).toBeVisible()

  // Ingredients came across as rows, not as one blob of text.
  await expect(page.getByLabel('Ingredient for line 1')).toHaveValue(/beans/i)
  await expect(page.getByLabel('Quantity for line 1')).toHaveValue('2')

  // Corrections on top of the parse are what actually gets saved -- the point
  // of showing the form rather than saving the draft outright.
  const title = `Lemon Butter Beans ${Date.now()}`
  await page.getByLabel('Title').fill(title)

  await page.getByRole('button', { name: 'Save recipe' }).click()
  // Every ingredient off a card is new to the library the first time, so the
  // confirmation always comes up on the first save of a fresh e2e database.
  await expect(page.getByText('New to your library')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm and save' }).click()

  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  // Keeping the photo defaults to off, so the saved page shows no card.
  await expect(page.getByText('Original photo')).toHaveCount(0)
})

test('keeps the card with the recipe when the cook asks it to', async ({ page }) => {
  await page.goto('/recipes/new')
  await page.getByRole('tab', { name: 'From a photo' }).click()
  await page.getByLabel('Recipe photo').setInputFiles(FIXTURE)
  await page.getByLabel(/keep the original photo/i).check()
  await page.getByRole('button', { name: 'Read photo' }).click()

  await expect(page.getByLabel('Title')).toHaveValue(/Lemon Butter Beans/i, {
    timeout: 150_000,
  })
  const title = `Kept Card ${Date.now()}`
  await page.getByLabel('Title').fill(title)

  await page.getByRole('button', { name: 'Save recipe' }).click()
  // Unlike the first spec, this one cannot count on the confirmation: it reads
  // the same card, so whether those ingredients are still new depends on
  // whether the first spec ran before it.
  const confirm = page.getByRole('button', { name: 'Confirm and save' })
  await expect(confirm.or(page.getByRole('heading', { name: title }))).toBeVisible()
  if (await confirm.isVisible()) await confirm.click()

  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  // Served from its own route rather than inlined, so a load proving 200 is
  // what proves the bytes actually reached the database.
  await page.getByText('Original photo').click()
  const photo = page.getByAltText(new RegExp(`${title} was read from`))
  await expect(photo).toBeVisible()
  // Polled rather than read once: the element has a box the moment it renders,
  // so a single read races the decode and sees a 0-wide image that is about to
  // be 900 wide. A non-zero width is what proves bytes came back, not markup.
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)
})
