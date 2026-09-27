import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'

let cleanup: () => void

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

afterAll(() => cleanup())

const FULL_RECIPE = {
  title: 'Cacio e Pepe',
  description: 'Three ingredients, no room to hide.',
  sourceUrl: 'https://example.com/cacio',
  prepMinutes: 5,
  cookMinutes: 10,
  servings: 2,
  instructions: 'Boil the pasta.\n\nToss with cheese and pepper.',
  notes: 'Reserve more pasta water than feels sane.',
  ingredients: [
    {
      quantity: 200, unit: 'gram', ingredient: 'spaghetti',
      note: null, rawText: '200 g spaghetti', confidence: 'high' as const,
    },
    {
      quantity: 1, unit: 'cup', ingredient: 'pecorino',
      note: 'finely grated', rawText: '1 cup pecorino, finely grated', confidence: 'high' as const,
    },
  ],
  tags: ['weeknight', 'italian'],
}

describe('exportRecipe', () => {
  it('includes every field the recipe was created with', async () => {
    const { createRecipe } = await import('./recipes')
    const { exportRecipe } = await import('./transfer')

    const id = await createRecipe(FULL_RECIPE)
    const doc = await exportRecipe(id)

    expect(doc).not.toBeNull()
    expect(doc!.recipe.title).toBe('Cacio e Pepe')
    expect(doc!.recipe.notes).toBe('Reserve more pasta water than feels sane.')
    expect(doc!.recipe.sourceUrl).toBe('https://example.com/cacio')
    expect(doc!.recipe.tags.sort()).toEqual(['italian', 'weeknight'])
    expect(doc!.recipe.ingredients).toHaveLength(2)
  })

  it('preserves rawText verbatim', async () => {
    const { createRecipe } = await import('./recipes')
    const { exportRecipe } = await import('./transfer')

    const id = await createRecipe(FULL_RECIPE)
    const doc = await exportRecipe(id)

    // rawText is never discarded anywhere in this app; an export that dropped
    // it would silently destroy the user's own wording on the way back in.
    expect(doc!.recipe.ingredients.map((row) => row.rawText)).toEqual([
      '200 g spaghetti',
      '1 cup pecorino, finely grated',
    ])
  })

  it('returns null for a recipe that does not exist', async () => {
    const { exportRecipe } = await import('./transfer')
    expect(await exportRecipe('nope')).toBeNull()
  })
})

describe('importRecipeDocument', () => {
  it('round-trips a single exported recipe without loss', async () => {
    const { createRecipe } = await import('./recipes')
    const { exportRecipe, importRecipeDocument } = await import('./transfer')

    const originalId = await createRecipe({ ...FULL_RECIPE, title: 'Round Trip' })
    const doc = await exportRecipe(originalId)

    const result = await importRecipeDocument(doc!)
    expect(result.imported).toBe(1)

    const reimported = await exportRecipe(result.ids[0])
    expect(reimported!.recipe.title).toBe('Round Trip')
    expect(reimported!.recipe.instructions).toBe(FULL_RECIPE.instructions)
    expect(reimported!.recipe.notes).toBe(FULL_RECIPE.notes)
    expect(reimported!.recipe.servings).toBe(2)
    expect(reimported!.recipe.tags.sort()).toEqual(['italian', 'weeknight'])
    expect(reimported!.recipe.ingredients.map((row) => row.rawText)).toEqual(
      FULL_RECIPE.ingredients.map((row) => row.rawText),
    )
  })

  it('imports a full archive of many recipes', async () => {
    const { exportAll, importRecipeDocument } = await import('./transfer')
    const { createRecipe } = await import('./recipes')

    await createRecipe({ ...FULL_RECIPE, title: 'Archive A' })
    await createRecipe({ ...FULL_RECIPE, title: 'Archive B' })

    const archive = await exportAll()
    expect(archive.recipes.length).toBeGreaterThanOrEqual(2)

    const result = await importRecipeDocument(archive)
    expect(result.imported).toBe(archive.recipes.length)
  })

  it('rejects a document that is not a Mangia export', async () => {
    const { importRecipeDocument } = await import('./transfer')
    await expect(
      importRecipeDocument({ hello: 'world' } as never),
    ).rejects.toThrow(/not a Mangia export/i)
  })

  it('rejects an export from a newer format version', async () => {
    const { importRecipeDocument } = await import('./transfer')
    await expect(
      importRecipeDocument({ mangia: { version: 99 }, recipes: [] } as never),
    ).rejects.toThrow(/newer version/i)
  })

  it('keeps a missing quantity null rather than coercing it to zero', async () => {
    const { importRecipeDocument, exportRecipe } = await import('./transfer')

    const result = await importRecipeDocument({
      mangia: { version: 1 },
      recipes: [
        {
          title: 'Pinch of Salt',
          instructions: 'Season.',
          description: null, sourceUrl: null, prepMinutes: null,
          cookMinutes: null, servings: null, notes: null, lastCookedAt: null,
          tags: [],
          ingredients: [
            { quantity: null, unit: null, ingredient: 'salt', note: null, rawText: 'salt to taste' },
          ],
          cookLog: [],
        },
      ],
    })

    const doc = await exportRecipe(result.ids[0])
    expect(doc!.recipe.ingredients[0].quantity).toBeNull()
  })

  it('carries the cooking history across', async () => {
    const { importRecipeDocument } = await import('./transfer')
    const { listCookLog } = await import('./cookLog')

    const result = await importRecipeDocument({
      mangia: { version: 1 },
      recipes: [
        {
          title: 'Logged Dish',
          instructions: 'Make it.',
          description: null, sourceUrl: null, prepMinutes: null,
          cookMinutes: null, servings: null, notes: null,
          lastCookedAt: '2026-04-01T12:00:00.000Z',
          tags: [], ingredients: [],
          cookLog: [{ cookedAt: '2026-04-01T12:00:00.000Z', note: 'Too salty.' }],
        },
      ],
    })

    const log = await listCookLog(result.ids[0])
    expect(log).toHaveLength(1)
    expect(log[0].note).toBe('Too salty.')
  })

  it('carries a photo across as base64, bytes intact', async () => {
    const { exportRecipe, importRecipeDocument } = await import('./transfer')
    const { setRecipePhoto, getRecipePhoto } = await import('./photos')
    const { createRecipe } = await import('./recipes')

    const bytes = Buffer.from([0xff, 0xd8, 0x00, 0x7f, 0x41])
    const source = await createRecipe({
      title: 'Photographed Card',
      instructions: 'Read the card.',
      ingredients: [],
    })
    await setRecipePhoto(source, bytes, 'image/jpeg')

    const doc = await exportRecipe(source)
    expect(doc!.recipe.photo).toEqual({
      mimeType: 'image/jpeg',
      data: bytes.toString('base64'),
    })

    const result = await importRecipeDocument(doc!)
    const restored = await getRecipePhoto(result.ids[0])
    expect(restored!.mimeType).toBe('image/jpeg')
    expect(Buffer.from(restored!.data).equals(bytes)).toBe(true)
  })

  it('imports a recipe from an older file that has no photo field', async () => {
    const { importRecipeDocument } = await import('./transfer')
    const { getRecipePhoto } = await import('./photos')

    const result = await importRecipeDocument({
      mangia: { version: 1 },
      recipes: [
        {
          title: 'Photoless',
          instructions: 'Make it.',
          description: null, sourceUrl: null, prepMinutes: null,
          cookMinutes: null, servings: null, notes: null,
          lastCookedAt: null, tags: [], ingredients: [], cookLog: [],
        },
      ],
    })

    expect(result.imported).toBe(1)
    expect(await getRecipePhoto(result.ids[0])).toBeNull()
  })

  it('drops a photo with a type it would not serve but keeps the recipe', async () => {
    const { importRecipeDocument } = await import('./transfer')
    const { getRecipePhoto } = await import('./photos')

    const result = await importRecipeDocument({
      mangia: { version: 1 },
      recipes: [
        {
          title: 'Tampered Backup',
          instructions: 'Make it.',
          description: null, sourceUrl: null, prepMinutes: null,
          cookMinutes: null, servings: null, notes: null,
          lastCookedAt: null, tags: [], ingredients: [], cookLog: [],
          photo: {
            mimeType: 'text/html',
            data: Buffer.from('<script>alert(1)</script>').toString('base64'),
          },
        },
      ],
    })

    expect(result.imported).toBe(1)
    expect(await getRecipePhoto(result.ids[0])).toBeNull()
  })
})

describe('nutrition in transfer', () => {
  const BARE = {
    description: null, sourceUrl: null, prepMinutes: null, cookMinutes: null,
    servings: 2, notes: null, lastCookedAt: null, tags: [], cookLog: [],
  }
  const VALUES = { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, sugar: 4.2, sodium: 4 }

  it('round-trips ingredient nutrition, unit weights and a recipe override', async () => {
    const { createRecipe } = await import('./recipes')
    const { resolveIngredient } = await import('./ingredients')
    const { upsertIngredientNutrition, upsertUnitWeight, setOverride, getOverride, getNutritionData } =
      await import('./nutrition')
    const { exportAll, importRecipeDocument } = await import('./transfer')
    const { db } = await import('./client')

    const id = await createRecipe({
      title: 'Onion Soup', instructions: 'Slow.', ingredients: [
        { quantity: 2, unit: null, ingredient: 'transfer onion', note: null, rawText: '2 transfer onion', confidence: 'high' },
      ], tags: [],
    })
    const onion = await resolveIngredient('transfer onion')
    await upsertIngredientNutrition(onion.id, { ...VALUES, source: 'usda', fdcId: 170000, fdcDescription: 'Onions, raw' })
    await upsertUnitWeight(onion.id, null, 110, 'usda')
    await upsertUnitWeight(onion.id, 'cup', null, 'unmatched')
    await setOverride(id, { ...VALUES, kcal: 320, note: 'From the label' })

    const doc = await exportAll()
    const exported = doc.ingredients!.find((row) => row.name === 'transfer onion')!
    expect(exported.nutrition).toMatchObject({ kcal: 40, source: 'usda', fdcId: 170000 })
    expect(exported.unitWeights).toContainEqual({ unit: null, grams: 110, source: 'usda' })
    expect(doc.recipes.find((r) => r.title === 'Onion Soup')!.nutritionOverride)
      .toEqual({ ...VALUES, kcal: 320, note: 'From the label' })

    // Wipe the ingredient's data so the import has gaps to fill.
    await db.ingredientNutrition.deleteMany({ where: { ingredientId: onion.id } })
    await db.ingredientUnitWeight.deleteMany({ where: { ingredientId: onion.id } })

    const result = await importRecipeDocument({
      ...doc, recipes: doc.recipes.filter((r) => r.title === 'Onion Soup'),
    })

    expect(await getOverride(result.ids[0])).toEqual({ ...VALUES, kcal: 320, note: 'From the label' })
    const restored = await getNutritionData([onion.id])
    expect(restored.nutrition.get(onion.id)).toMatchObject({ kcal: 40, source: 'usda', fdcDescription: 'Onions, raw' })
    // The unmatched cup stays open for this install to look up itself.
    expect(restored.weights.get(onion.id)).toEqual([{ unit: null, grams: 110, source: 'usda' }])
  })

  it('never overwrites known data but replaces unmatched rows', async () => {
    const { resolveIngredient } = await import('./ingredients')
    const { upsertIngredientNutrition, upsertUnitWeight, getNutritionData } = await import('./nutrition')
    const { importRecipeDocument } = await import('./transfer')

    const kept = await resolveIngredient('transfer kept')
    const gap = await resolveIngredient('transfer gap')
    await upsertIngredientNutrition(kept.id, { ...VALUES, kcal: 99, source: 'manual', fdcId: null, fdcDescription: null })
    await upsertUnitWeight(kept.id, 'cup', 200, 'manual')
    await upsertIngredientNutrition(gap.id, { ...VALUES, source: 'unmatched', fdcId: null, fdcDescription: null })
    await upsertUnitWeight(gap.id, 'cup', null, 'unmatched')

    const incoming = { ...VALUES, kcal: 55, source: 'ai' as const, fdcId: null, fdcDescription: null }
    await importRecipeDocument({
      mangia: { version: 1 },
      recipes: [],
      ingredients: [
        { name: 'Transfer Kept', nutrition: incoming, unitWeights: [{ unit: 'cup', grams: 150, source: 'ai' }] },
        { name: 'transfer gap', nutrition: incoming, unitWeights: [{ unit: 'cup', grams: 150, source: 'ai' }] },
        { name: 'transfer new', nutrition: { ...incoming, kcal: 5000 }, unitWeights: [{ unit: 'cup', grams: -1, source: 'ai' }] },
      ],
    })

    const newer = await resolveIngredient('transfer new')
    const data = await getNutritionData([kept.id, gap.id, newer.id])
    expect(data.nutrition.get(kept.id)).toMatchObject({ kcal: 99, source: 'manual' })
    expect(data.weights.get(kept.id)).toEqual([{ unit: 'cup', grams: 200, source: 'manual' }])
    expect(data.nutrition.get(gap.id)).toMatchObject({ kcal: 55, source: 'ai' })
    expect(data.weights.get(gap.id)).toEqual([{ unit: 'cup', grams: 150, source: 'ai' }])
    // Implausible values are dropped rather than stored.
    expect(data.nutrition.get(newer.id)).toBeUndefined()
    expect(data.weights.get(newer.id)).toBeUndefined()
  })

  it('reads a file with no nutrition fields at all', async () => {
    const { importRecipeDocument } = await import('./transfer')
    const { getOverride } = await import('./nutrition')
    const result = await importRecipeDocument({
      mangia: { version: 1 },
      recipes: [{ ...BARE, title: 'Old File', instructions: 'Make it.', ingredients: [] }],
    })
    expect(await getOverride(result.ids[0])).toBeNull()
  })
})
