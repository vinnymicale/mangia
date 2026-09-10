import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'
import type { ParsedIngredient } from '@/lib/parsing/types'
import type { mergeIngredients as MergeIngredients } from './shoppingList'

let cleanup: () => void
// Importing './shoppingList' at module scope would pull in the `db` singleton,
// which binds DATABASE_URL at construction — before beforeAll can point it at
// the throwaway database. Every other db test dodges this with a dynamic
// import; mergeIngredients is pure, so it just needs to load after the env is set.
let mergeIngredients: typeof MergeIngredients

function ing(
  name: string,
  quantity: number | null,
  unit: string | null,
): ParsedIngredient {
  return {
    quantity, unit, ingredient: name, note: null,
    rawText: `${quantity ?? ''} ${unit ?? ''} ${name}`.trim(),
    confidence: 'high',
  }
}

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

beforeAll(async () => {
  ;({ mergeIngredients } = await import('./shoppingList'))
})

afterAll(() => cleanup())

describe('mergeIngredients', () => {
  const row = (
    ingredientId: string,
    name: string,
    quantity: number | null,
    unit: string | null,
    recipeId: string,
  ) => ({
    ingredientId,
    name,
    category: null,
    quantity,
    unit,
    recipeId,
    rawText: `${quantity ?? ''} ${unit ?? ''} ${name}`.trim(),
  })

  it('sums identical units', () => {
    const merged = mergeIngredients([
      row('i1', 'flour', 2, 'cup', 'r1'),
      row('i1', 'flour', 1, 'cup', 'r2'),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].quantity).toBe(3)
    expect(merged[0].unit).toBe('cup')
  })

  it('converts within a compatibility group', () => {
    const merged = mergeIngredients([
      row('i1', 'milk', 1, 'cup', 'r1'),
      row('i1', 'milk', 4, 'tablespoon', 'r2'),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].unit).toBe('cup')
    expect(merged[0].quantity).toBeCloseTo(1.25, 5)
  })

  it('keeps incompatible units on separate lines', () => {
    const merged = mergeIngredients([
      row('i1', 'flour', 2, 'cup', 'r1'),
      row('i1', 'flour', 500, 'gram', 'r2'),
    ])
    expect(merged).toHaveLength(2)
  })

  it('keeps unitless entries separate from measured ones', () => {
    const merged = mergeIngredients([
      row('i1', 'onion', 2, null, 'r1'),
      row('i1', 'onion', 1, 'cup', 'r2'),
    ])
    expect(merged).toHaveLength(2)
  })

  it('sums unitless counts together', () => {
    const merged = mergeIngredients([
      row('i1', 'egg', 2, null, 'r1'),
      row('i1', 'egg', 3, null, 'r2'),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].quantity).toBe(5)
  })

  it('keeps unrecognized units apart instead of summing them', () => {
    // normalizeUnit returns null for any token it does not know, which used to
    // drop these into the same bucket as genuinely unitless rows -- summing
    // "2 sploops" and "3 blorps" into a bare 5.
    const merged = mergeIngredients([
      row('i1', 'salt', 2, 'sploops', 'r1'),
      row('i1', 'salt', 3, 'blorps', 'r2'),
    ])
    expect(merged).toHaveLength(2)
    expect(merged[0].unit).toBe('sploops')
    expect(merged[1].unit).toBe('blorps')
  })

  it('does not merge an unrecognized unit with a unitless row', () => {
    const merged = mergeIngredients([
      row('i1', 'salt', 2, 'sploops', 'r1'),
      row('i1', 'salt', 3, null, 'r2'),
    ])
    expect(merged).toHaveLength(2)
  })

  it('still sums two rows sharing the same unrecognized unit', () => {
    const merged = mergeIngredients([
      row('i1', 'salt', 2, 'sploops', 'r1'),
      row('i1', 'salt', 3, 'Sploops', 'r2'),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].quantity).toBe(5)
  })

  it('leaves quantity null when every source is null', () => {
    const merged = mergeIngredients([
      row('i1', 'salt', null, null, 'r1'),
      row('i1', 'salt', null, null, 'r2'),
    ])
    expect(merged[0].quantity).toBeNull()
  })

  it('does not treat a null quantity as zero', () => {
    const merged = mergeIngredients([
      row('i1', 'olive oil', 2, 'tablespoon', 'r1'),
      row('i1', 'olive oil', null, 'tablespoon', 'r2'),
    ])
    expect(merged[0].quantity).toBe(2)
    expect(merged[0].rawTexts).toHaveLength(2)
  })

  it('keeps different ingredients apart', () => {
    const merged = mergeIngredients([
      row('i1', 'flour', 1, 'cup', 'r1'),
      row('i2', 'sugar', 1, 'cup', 'r1'),
    ])
    expect(merged).toHaveLength(2)
  })

  it('records every source recipe', () => {
    const merged = mergeIngredients([
      row('i1', 'flour', 1, 'cup', 'r1'),
      row('i1', 'flour', 1, 'cup', 'r2'),
    ])
    expect(merged[0].sourceRecipeIds.sort()).toEqual(['r1', 'r2'])
  })

  it('deduplicates a repeated source recipe', () => {
    const merged = mergeIngredients([
      row('i1', 'flour', 1, 'cup', 'r1'),
      row('i1', 'flour', 1, 'cup', 'r1'),
    ])
    expect(merged[0].sourceRecipeIds).toEqual(['r1'])
  })
})

describe('generateShoppingList', () => {
  it('builds a list from selected recipes', async () => {
    const { createRecipe } = await import('./recipes')
    const { generateShoppingList, getShoppingList } = await import('./shoppingList')
    const a = await createRecipe({
      title: 'A', instructions: '',
      ingredients: [ing('flour', 2, 'cup'), ing('egg', 2, null)],
    })
    const b = await createRecipe({
      title: 'B', instructions: '',
      ingredients: [ing('flour', 1, 'cup'), ing('milk', 1, 'cup')],
    })
    const listId = await generateShoppingList([a, b], { name: 'Week 1' })
    const list = await getShoppingList(listId)
    expect(list?.name).toBe('Week 1')
    const flour = list!.items.find((i) => i.ingredient?.name === 'flour')!
    expect(flour.quantity).toBe(3)
    expect(list!.items).toHaveLength(3)
  })

  it('excludes pantry staples', async () => {
    const { createRecipe } = await import('./recipes')
    const { resolveIngredient } = await import('./ingredients')
    const { db } = await import('./client')
    const { generateShoppingList, getShoppingList } = await import('./shoppingList')

    const salt = await resolveIngredient('salt')
    await db.pantryStaple.upsert({
      where: { ingredientId: salt.id },
      create: { name: salt.name, ingredientId: salt.id },
      update: {},
    })

    const id = await createRecipe({
      title: 'Salty', instructions: '',
      ingredients: [ing('salt', 1, 'teaspoon'), ing('pepper', 1, 'teaspoon')],
    })
    const list = await getShoppingList(
      await generateShoppingList([id], { excludeStaples: true }),
    )
    expect(list!.items.map((i) => i.ingredient?.name)).toEqual(['pepper'])
  })

  it('links each item back to its source recipes', async () => {
    const { createRecipe } = await import('./recipes')
    const { generateShoppingList, getShoppingList } = await import('./shoppingList')
    const a = await createRecipe({
      title: 'C', instructions: '', ingredients: [ing('butter', 1, 'cup')],
    })
    const b = await createRecipe({
      title: 'D', instructions: '', ingredients: [ing('butter', 1, 'cup')],
    })
    const list = await getShoppingList(await generateShoppingList([a, b]))
    expect(list!.items[0].sources).toHaveLength(2)
  })
})

describe('toggleItemChecked', () => {
  it('marks an item checked and back', async () => {
    const { createRecipe } = await import('./recipes')
    const { generateShoppingList, getShoppingList, toggleItemChecked } =
      await import('./shoppingList')
    const id = await createRecipe({
      title: 'E', instructions: '', ingredients: [ing('rice', 1, 'cup')],
    })
    const listId = await generateShoppingList([id])
    const before = await getShoppingList(listId)
    await toggleItemChecked(before!.items[0].id, true)
    const after = await getShoppingList(listId)
    expect(after!.items[0].checked).toBe(true)
  })
})

describe('addManualItem', () => {
  it('links an item whose name is a known ingredient', async () => {
    const { resolveIngredient } = await import('./ingredients')
    const { generateShoppingList, addManualItem } = await import('./shoppingList')
    await resolveIngredient('shallot')
    const listId = await generateShoppingList([])
    const item = await addManualItem(listId, { name: 'Shallot', quantity: 2, unit: null })
    expect(item.ingredient?.name).toBe('shallot')
    expect(item.manualText).toBeNull()
  })

  it('follows an alias to the canonical ingredient', async () => {
    const { resolveIngredient, linkAlias } = await import('./ingredients')
    const { generateShoppingList, addManualItem } = await import('./shoppingList')
    await resolveIngredient('coriander')
    await linkAlias('cilantro', 'coriander')
    const listId = await generateShoppingList([])
    const item = await addManualItem(listId, { name: 'cilantro' })
    expect(item.ingredient?.name).toBe('coriander')
  })

  it('keeps an unrecognized name as manual text without inventing an ingredient', async () => {
    // "batteries" is not food. Creating an Ingredient row for it would leak
    // into pantry matching and the unknown-ingredient prompts forever.
    const { db } = await import('./client')
    const { generateShoppingList, addManualItem } = await import('./shoppingList')
    const listId = await generateShoppingList([])
    const item = await addManualItem(listId, { name: 'Batteries', quantity: 4, unit: null })
    expect(item.ingredientId).toBeNull()
    expect(item.manualText).toBe('Batteries')
    expect(item.quantity).toBe(4)
    expect(await db.ingredient.count({ where: { name: 'batteries' } })).toBe(0)
  })
})
