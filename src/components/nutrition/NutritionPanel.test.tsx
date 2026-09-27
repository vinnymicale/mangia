import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NutritionPanel } from './NutritionPanel'
import type { NutritionLine, RecipeNutrition } from '@/lib/nutrition/compute'
import { EMPTY_NUTRIENTS } from '@/lib/nutrition/types'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

function line(patch: Partial<NutritionLine>): NutritionLine {
  return {
    recipeIngredientId: 'ri-1', ingredientId: 'ing-1', name: 'onion', quantity: 1, unit: null,
    grams: 110, nutrients: { ...EMPTY_NUTRIENTS, kcal: 44 }, status: 'counted', fdcDescription: 'Onions, raw',
    ...patch,
  }
}

function nutrition(patch: Partial<RecipeNutrition> = {}): RecipeNutrition {
  return {
    basis: 'serving',
    totals: { ...EMPTY_NUTRIENTS, kcal: 639.6, protein: 38.4, carbs: 52, fat: 28 },
    source: 'estimate', overrideNote: null,
    lines: [line({})], counted: 1, countable: 1, needsInput: 0, pending: false,
    ...patch,
  }
}

function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  refresh.mockClear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('NutritionPanel', () => {
  it('shows the figures and what they cover without fetching', () => {
    render(<NutritionPanel recipeId="r1" initial={nutrition({ countable: 2 })} aiConfigured={false} />)
    expect(screen.getByText('640 kcal')).toBeInTheDocument()
    expect(screen.getByText('38 g')).toBeInTheDocument()
    expect(screen.getByText('Estimate covers 1 of 2 ingredients')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('looks up pending lines on mount and shows the unavailable notice', async () => {
    fetchMock.mockImplementation(() => respond({ ...nutrition({ pending: true }), usdaUnavailable: true }))
    render(
      <NutritionPanel
        recipeId="r1"
        initial={nutrition({ source: 'none', totals: EMPTY_NUTRIENTS, pending: true })}
        aiConfigured={false}
      />,
    )
    expect(screen.getByText('Estimating…')).toBeInTheDocument()
    expect(await screen.findByText(/could not be reached/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/recipes/r1/nutrition')
    expect(init.method).toBe('POST')
    expect(refresh).toHaveBeenCalled()
  })

  it('shows the override note in place of coverage', () => {
    render(
      <NutritionPanel
        recipeId="r1"
        initial={nutrition({ source: 'override', overrideNote: 'From source page' })}
        aiConfigured={false}
      />,
    )
    expect(screen.getByText('From source page')).toBeInTheDocument()
  })

  it('saves a weight for a gap and reloads', async () => {
    const gap = line({ status: 'needsWeight', unit: 'clove', name: 'garlic', grams: null, nutrients: null })
    fetchMock.mockImplementation((url: string) =>
      url.includes('/weights') ? respond({ nutrition: null, weights: [] }) : respond(nutrition()),
    )
    render(
      <NutritionPanel recipeId="r1" initial={nutrition({ lines: [gap], needsInput: 1 })} aiConfigured={false} />,
    )
    await userEvent.click(screen.getByRole('button', { name: '1 ingredient needs input' }))
    expect(screen.getByText('How much does 1 clove of garlic weigh?')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Grams in 1 clove of garlic'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/ingredients/ing-1/weights')
    expect(JSON.parse(init.body)).toEqual({ unit: 'clove', grams: 5 })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/recipes/r1/nutrition')
  })

  it('pre-fills nutrition from the model and saves it as ai, per unit', async () => {
    const gap = line({ status: 'needsNutrition', name: 'quince', grams: null, nutrients: null, fdcDescription: null })
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/nutrition/suggest') return respond({ nutrients: { ...EMPTY_NUTRIENTS, kcal: 57 } })
      if (url.startsWith('/api/ingredients')) return respond({ nutrition: null, weights: [] })
      return respond(nutrition())
    })
    render(
      <NutritionPanel recipeId="r1" initial={nutrition({ lines: [gap], needsInput: 1 })} aiConfigured />,
    )
    await userEvent.click(screen.getByRole('button', { name: '1 ingredient needs input' }))
    expect(await screen.findByText('AI estimate — check before saving')).toBeInTheDocument()
    expect(screen.getByLabelText('Calories (kcal)')).toHaveValue(57)

    await userEvent.click(screen.getByLabelText('Per quince'))
    await userEvent.type(screen.getByLabelText('Grams in 1 quince'), '200')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/ingredients/ing-1/nutrition', expect.anything(),
    ))
    const put = fetchMock.mock.calls.find(([url]) => url === '/api/ingredients/ing-1/nutrition')!
    expect(JSON.parse(put[1].body)).toEqual({
      source: 'ai',
      nutrients: { ...EMPTY_NUTRIENTS, kcal: 57 },
      per: { unit: null, grams: 200 },
    })
  })

  it('sets and clears an override', async () => {
    fetchMock.mockImplementation(() => respond(nutrition({ source: 'override', overrideNote: 'Label' })))
    render(<NutritionPanel recipeId="r1" initial={nutrition()} aiConfigured={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Override' }))
    await userEvent.type(screen.getByLabelText('Calories (kcal)'), '500')
    await userEvent.type(screen.getByLabelText('Note'), 'Label')
    await userEvent.click(screen.getByRole('button', { name: 'Save override' }))

    expect(await screen.findByText('Label')).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/recipes/r1/nutrition/override')
    expect(JSON.parse(init.body)).toMatchObject({ kcal: 500, protein: null, note: 'Label' })

    fetchMock.mockImplementation(() => respond(nutrition()))
    await userEvent.click(screen.getByRole('button', { name: 'Override' }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear override' }))
    expect(await screen.findByText('Estimate covers 1 of 1 ingredients')).toBeInTheDocument()
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
  })
})
