import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IngredientReviewTable } from './IngredientReviewTable'
import type { ParsedIngredient } from '@/lib/parsing/types'

function row(
  overrides: Partial<ParsedIngredient> = {},
): ParsedIngredient {
  return {
    quantity: 2,
    unit: 'cup',
    ingredient: 'flour',
    note: null,
    rawText: '2 cups flour',
    confidence: 'high',
    ...overrides,
  }
}

describe('IngredientReviewTable', () => {
  it('renders one editable row per ingredient', () => {
    render(<IngredientReviewTable value={[row(), row({ ingredient: 'sugar' })]} onChange={() => {}} />)
    expect(screen.getAllByLabelText(/ingredient/i)).toHaveLength(2)
  })

  it('shows the parsed quantity and unit', () => {
    render(<IngredientReviewTable value={[row()]} onChange={() => {}} />)
    expect(screen.getByLabelText(/quantity/i)).toHaveValue('2')
    expect(screen.getByLabelText(/unit/i)).toHaveValue('cup')
  })

  it('flags a low-confidence row', () => {
    render(
      <IngredientReviewTable
        value={[row({ confidence: 'low', quantity: null, unit: null })]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('row', { name: /needs review/i })).toBeDefined()
  })

  it('does not flag a high-confidence row', () => {
    render(<IngredientReviewTable value={[row()]} onChange={() => {}} />)
    expect(screen.queryByText(/needs review/i)).toBeNull()
  })

  it('emits an updated ingredient name on edit', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<IngredientReviewTable value={[row()]} onChange={onChange} />)
    await user.type(screen.getByLabelText(/ingredient/i), 'X')
    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)![0] as ParsedIngredient[]
    expect(next[0].ingredient).toBe('flourX')
  })

  it('parses a typed quantity into a number', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<IngredientReviewTable value={[row({ quantity: null })]} onChange={onChange} />)
    await user.type(screen.getByLabelText(/quantity/i), '1.5')
    const next = onChange.mock.calls.at(-1)![0] as ParsedIngredient[]
    expect(next[0].quantity).toBe(1.5)
  })

  it('accepts a typed fraction', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<IngredientReviewTable value={[row({ quantity: null })]} onChange={onChange} />)
    await user.type(screen.getByLabelText(/quantity/i), '1/2')
    const next = onChange.mock.calls.at(-1)![0] as ParsedIngredient[]
    expect(next[0].quantity).toBe(0.5)
  })

  it('sets quantity to null when the field is cleared, never 0', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<IngredientReviewTable value={[row()]} onChange={onChange} />)
    await user.clear(screen.getByLabelText(/quantity/i))
    const next = onChange.mock.calls.at(-1)![0] as ParsedIngredient[]
    expect(next[0].quantity).toBeNull()
  })

  it('removes a row', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <IngredientReviewTable
        value={[row(), row({ ingredient: 'sugar' })]}
        onChange={onChange}
      />,
    )
    await user.click(screen.getAllByRole('button', { name: /remove/i })[0])
    const next = onChange.mock.calls.at(-1)![0] as ParsedIngredient[]
    expect(next).toHaveLength(1)
    expect(next[0].ingredient).toBe('sugar')
  })

  it('adds an empty row', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<IngredientReviewTable value={[row()]} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /add ingredient/i }))
    const next = onChange.mock.calls.at(-1)![0] as ParsedIngredient[]
    expect(next).toHaveLength(2)
    expect(next[1].ingredient).toBe('')
  })

  it('offers clean-up only when low-confidence rows exist', () => {
    const { rerender } = render(
      <IngredientReviewTable value={[row()]} onChange={() => {}} onCleanUp={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: /clean up/i })).toBeNull()

    rerender(
      <IngredientReviewTable
        value={[row({ confidence: 'low' })]}
        onChange={() => {}}
        onCleanUp={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /clean up 1 line/i })).toBeDefined()
  })

  it('passes the low-confidence row indexes to onCleanUp', async () => {
    const onCleanUp = vi.fn()
    const user = userEvent.setup()
    render(
      <IngredientReviewTable
        value={[row(), row({ confidence: 'low' }), row({ confidence: 'low' })]}
        onChange={() => {}}
        onCleanUp={onCleanUp}
      />,
    )
    await user.click(screen.getByRole('button', { name: /clean up 2 lines/i }))
    expect(onCleanUp).toHaveBeenCalledWith([1, 2])
  })

  it('shows the original text so nothing looks lost', () => {
    render(
      <IngredientReviewTable
        value={[row({ rawText: 'a good glug of olive oil' })]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('a good glug of olive oil')).toBeDefined()
  })
})
