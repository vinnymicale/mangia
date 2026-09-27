import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipeForm, EMPTY_RECIPE } from './RecipeForm'
import { EMPTY_NUTRIENTS } from '@/lib/nutrition/types'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  push.mockClear()
  fetchMock = vi.fn((url: string) =>
    url === '/api/unknown-ingredients' ? respond({ unknown: [] }) : respond({ id: 'r1' }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

function savedBody() {
  const call = fetchMock.mock.calls.find(([url]) => String(url).startsWith('/api/recipes'))
  return JSON.parse((call![1] as RequestInit).body as string)
}

describe('RecipeForm nutrition', () => {
  it('sends no override when the fields are left empty', async () => {
    render(<RecipeForm initial={{ ...EMPTY_RECIPE, title: 'Soup' }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save recipe' }))
    expect(savedBody().nutritionOverride).toBeNull()
    expect(push).toHaveBeenCalledWith('/recipes/r1')
  })

  it('sends the values and note typed in', async () => {
    render(<RecipeForm initial={{ ...EMPTY_RECIPE, title: 'Soup' }} />)
    await userEvent.click(screen.getByText('Nutrition (optional)'))
    await userEvent.type(screen.getByLabelText('Calories (kcal)'), '320')
    await userEvent.type(screen.getByLabelText('Note'), 'From the label')
    await userEvent.click(screen.getByRole('button', { name: 'Save recipe' }))
    expect(savedBody().nutritionOverride).toEqual({ ...EMPTY_NUTRIENTS, kcal: 320, note: 'From the label' })
  })

  it('clears a stored override when every value is blanked', async () => {
    render(
      <RecipeForm
        initial={{
          ...EMPTY_RECIPE, id: 'r1', title: 'Soup',
          nutritionOverride: { ...EMPTY_NUTRIENTS, kcal: 410, note: 'From source page' },
        }}
      />,
    )
    await userEvent.click(screen.getByText('Nutrition (optional)'))
    expect(screen.getByLabelText('Note')).toHaveValue('From source page')
    await userEvent.clear(screen.getByLabelText('Calories (kcal)'))
    await userEvent.click(screen.getByRole('button', { name: 'Save recipe' }))
    expect(savedBody().nutritionOverride).toBeNull()
  })

  it('refuses a negative value without saving', async () => {
    render(<RecipeForm initial={{ ...EMPTY_RECIPE, title: 'Soup' }} />)
    await userEvent.click(screen.getByText('Nutrition (optional)'))
    await userEvent.type(screen.getByLabelText('Fat (g)'), '-2')
    await userEvent.click(screen.getByRole('button', { name: 'Save recipe' }))
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/recipes'))).toBe(false)
  })
})
