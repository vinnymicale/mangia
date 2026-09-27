import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IngredientNutritionTable } from './IngredientNutritionTable'
import type { IngredientNutritionData, IngredientNutritionRow } from '@/lib/db/nutrition'
import { EMPTY_NUTRIENTS } from '@/lib/nutrition/types'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

function profile(patch: Partial<IngredientNutritionData> = {}): IngredientNutritionData {
  return {
    ...EMPTY_NUTRIENTS, kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1,
    source: 'usda', fdcId: 170000, fdcDescription: 'Onions, raw',
    ...patch,
  }
}

const ROWS: IngredientNutritionRow[] = [
  { id: 'onion', name: 'onion', recipeCount: 3, nutrition: profile(), weights: [{ unit: null, grams: 110, source: 'usda' }] },
  {
    id: 'garlic', name: 'garlic', recipeCount: 2,
    nutrition: profile({ kcal: 149, fdcDescription: 'Garlic, raw', fdcId: 169230 }),
    weights: [{ unit: 'clove', grams: null, source: 'unmatched' }],
  },
  { id: 'saffron', name: 'saffron', recipeCount: 1, nutrition: null, weights: [] },
]

function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

function names() {
  return screen.queryAllByRole('button', { expanded: false }).map((b) => b.textContent)
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  refresh.mockClear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('IngredientNutritionTable', () => {
  it('lists each ingredient with its figures, source and recipe count', () => {
    render(<IngredientNutritionTable initial={ROWS} />)
    const onion = screen.getByRole('button', { name: 'onion' }).closest('tr')!
    expect(within(onion).getByText('40')).toBeInTheDocument()
    expect(within(onion).getByText('USDA')).toBeInTheDocument()
    expect(within(onion).getByText('3')).toBeInTheDocument()
    const saffron = screen.getByRole('button', { name: 'saffron' }).closest('tr')!
    expect(within(saffron).getByText('No data')).toBeInTheDocument()
  })

  it('filters to gaps, to missing data, and by name', async () => {
    render(<IngredientNutritionTable initial={ROWS} />)
    await userEvent.click(screen.getByRole('button', { name: 'Needs input' }))
    expect(names()).toEqual(['garlic'])
    await userEvent.click(screen.getByRole('button', { name: 'No data', pressed: false }))
    expect(names()).toEqual(['saffron'])
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    await userEvent.type(screen.getByLabelText('Search ingredients'), 'ONI')
    expect(names()).toEqual(['onion'])
  })

  it('saves manual values and shows them in the row', async () => {
    fetchMock.mockImplementation(() =>
      respond({ nutrition: profile({ kcal: 50, source: 'manual' }), weights: ROWS[0].weights }))
    render(<IngredientNutritionTable initial={ROWS} />)
    await userEvent.click(screen.getByRole('button', { name: 'onion' }))
    const kcal = screen.getByLabelText('Calories (kcal)')
    await userEvent.clear(kcal)
    await userEvent.type(kcal, '50')
    await userEvent.click(screen.getByRole('button', { name: 'Save values' }))

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/ingredients/onion/nutrition')
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ source: 'manual', per: null, nutrients: { kcal: 50, protein: 1.1 } })

    const row = screen.getByRole('button', { name: 'onion' }).closest('tr')!
    expect(await within(row).findByText('Manual')).toBeInTheDocument()
    expect(within(row).getByText('50')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset to USDA' })).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('fills a missing unit weight', async () => {
    fetchMock.mockImplementation(() =>
      respond({ nutrition: ROWS[1].nutrition, weights: [{ unit: 'clove', grams: 3, source: 'manual' }] }))
    render(<IngredientNutritionTable initial={ROWS} />)
    await userEvent.click(screen.getByRole('button', { name: 'garlic' }))
    expect(screen.getByText('Not found')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Grams in 1 clove'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/ingredients/garlic/weights')
    expect(JSON.parse(init.body as string)).toEqual({ unit: 'clove', grams: 3 })
    expect(screen.queryByText('Not found')).not.toBeInTheDocument()
  })

  it('adds a bare-count weight and removes one by unit', async () => {
    fetchMock.mockImplementation(() => respond({ nutrition: null, weights: [] }))
    render(<IngredientNutritionTable initial={ROWS} />)
    await userEvent.click(screen.getByRole('button', { name: 'saffron' }))
    await userEvent.type(screen.getByLabelText('Grams'), '0.1')
    await userEvent.click(screen.getByRole('button', { name: 'Add weight' }))
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string))
      .toEqual({ unit: null, grams: 0.1 })

    await userEvent.click(screen.getByRole('button', { name: 'saffron' }))
    await userEvent.click(screen.getByRole('button', { name: 'garlic' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove weight for 1 clove' }))
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe('/api/ingredients/garlic/weights?unit=clove')
    expect(init.method).toBe('DELETE')
  })

  it('shows the route error inline', async () => {
    fetchMock.mockImplementation(() => respond({ error: 'USDA is unavailable.' }, 503))
    render(<IngredientNutritionTable initial={ROWS} />)
    await userEvent.click(screen.getByRole('button', { name: 'garlic' }))
    await userEvent.click(screen.getByRole('button', { name: 'Leave blank' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('USDA is unavailable.')
  })
})
