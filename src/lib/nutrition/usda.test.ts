import { describe, it, expect, vi, afterEach } from 'vitest'
import { getFoods, mapNutrients, mapPortions, searchFoods, UsdaUnavailableError } from './usda'

const OPTIONS = { apiKey: null, baseUrl: 'http://usda.test/fdc/' }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchFoods', () => {
  it('asks for Foundation and SR Legacy only, with DEMO_KEY when no key is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      foods: [
        { fdcId: 1, description: 'Onions, raw', dataType: 'SR Legacy' },
        { description: 'no id' },
      ],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchFoods('onion', OPTIONS)

    expect(results).toEqual([{ fdcId: 1, description: 'Onions, raw', dataType: 'SR Legacy' }])
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://usda.test/fdc/v1/foods/search?api_key=DEMO_KEY')
    expect(JSON.parse(init.body)).toEqual({
      query: 'onion', dataType: ['Foundation', 'SR Legacy'], pageSize: 10,
    })
  })

  it.each([429, 503])('treats %s as unavailable', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, status)))
    await expect(searchFoods('onion', OPTIONS)).rejects.toBeInstanceOf(UsdaUnavailableError)
  })

  it('treats a network failure as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(searchFoods('onion', OPTIONS)).rejects.toBeInstanceOf(UsdaUnavailableError)
  })

  it('reports a rejected key as an ordinary error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 403)))
    const error = await searchFoods('onion', { ...OPTIONS, apiKey: 'bad' }).catch((e) => e)
    expect(error).not.toBeInstanceOf(UsdaUnavailableError)
    expect(error.message).toMatch(/403/)
  })
})

describe('mapNutrients', () => {
  it('reads the seven values from the full format', () => {
    const nutrients = mapNutrients([
      { nutrient: { id: 1008 }, amount: 40 },
      { nutrient: { id: 1003 }, amount: 1.1 },
      { nutrient: { id: 1004 }, amount: 0.1 },
      { nutrient: { id: 1005 }, amount: 9.3 },
      { nutrient: { id: 1079 }, amount: 1.7 },
      { nutrient: { id: 2000 }, amount: 4.2 },
      { nutrient: { id: 1093 }, amount: 4 },
    ])
    expect(nutrients).toEqual({
      kcal: 40, protein: 1.1, fat: 0.1, carbs: 9.3, fiber: 1.7, sugar: 4.2, sodium: 4,
    })
  })

  it('falls back to Atwater energy and the older sugar ID', () => {
    const nutrients = mapNutrients([
      { nutrient: { id: 2048 }, amount: 44 },
      { nutrient: { id: 2047 }, amount: 42 },
      { nutrient: { id: 1063 }, amount: 3 },
    ])
    expect(nutrients.kcal).toBe(42)
    expect(nutrients.sugar).toBe(3)
    expect(nutrients.protein).toBeNull()
  })

  it('reads the abridged format', () => {
    expect(mapNutrients([{ nutrientId: 1003, value: 5 }]).protein).toBe(5)
  })
})

describe('mapPortions', () => {
  it('reads SR Legacy modifiers and divides by the amount', () => {
    const portions = mapPortions([
      { gramWeight: 160, amount: 1, modifier: 'cup, chopped', measureUnit: { name: 'undetermined' } },
      { gramWeight: 30, amount: 2, modifier: 'tbsp', measureUnit: { name: 'undetermined' } },
      { gramWeight: 150, amount: 1, modifier: 'large', measureUnit: { name: 'undetermined' } },
      { gramWeight: 110, amount: 1, modifier: 'medium (2-1/2" dia)', measureUnit: { name: 'undetermined' } },
      { gramWeight: 70, amount: 1, modifier: 'small', measureUnit: { name: 'undetermined' } },
    ])
    expect(portions).toContainEqual({ unit: 'cup', grams: 160, label: 'cup, chopped' })
    expect(portions).toContainEqual({ unit: 'tablespoon', grams: 15, label: 'tbsp' })
    // Only one bare count, and it is the medium one.
    expect(portions.filter((p) => p.unit === null)).toEqual([
      { unit: null, grams: 110, label: 'medium (2-1/2" dia)' },
    ])
  })

  it('reads Foundation measure units and keeps the first per unit', () => {
    const portions = mapPortions([
      { gramWeight: 125, amount: 1, measureUnit: { name: 'cup' } },
      { gramWeight: 140, amount: 1, modifier: 'packed', measureUnit: { name: 'cup' } },
    ])
    expect(portions).toEqual([{ unit: 'cup', grams: 125, label: 'cup' }])
  })

  it('drops weight units and portions it cannot read', () => {
    expect(mapPortions([
      { gramWeight: 28.35, amount: 1, modifier: 'oz', measureUnit: { name: 'undetermined' } },
      { gramWeight: 5, amount: 1, modifier: 'fruit without seeds', measureUnit: { name: 'undetermined' } },
      { amount: 1, modifier: 'cup' },
    ])).toEqual([])
  })
})

describe('getFoods', () => {
  it('fetches a batch in the full format', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([
      {
        fdcId: 7,
        description: 'Butter, salted',
        foodNutrients: [{ nutrient: { id: 1004 }, amount: 81 }],
        foodPortions: [{ gramWeight: 14.2, amount: 1, modifier: 'tbsp', measureUnit: { name: 'undetermined' } }],
      },
    ]))
    vi.stubGlobal('fetch', fetchMock)

    const foods = await getFoods([7], { ...OPTIONS, apiKey: 'k' })

    expect(foods[0].nutrients.fat).toBe(81)
    expect(foods[0].portions).toEqual([{ unit: 'tablespoon', grams: 14.2, label: 'tbsp' }])
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://usda.test/fdc/v1/foods?api_key=k')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ fdcIds: [7], format: 'full' })
  })

  it('makes no request for an empty batch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await getFoods([], OPTIONS)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
