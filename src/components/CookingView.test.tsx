import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CookingView } from './CookingView'

function renderView(notes: string[]) {
  return render(
    <CookingView
      recipeId="r1"
      title="Braise"
      ingredients={[]}
      steps={['Sear.']}
      notes={notes}
      lastCookedAt={null}
    />,
  )
}

describe('CookingView notes', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders nothing when the recipe has no notes', () => {
    renderView([])
    expect(screen.queryByRole('button', { name: /notes/i })).not.toBeInTheDocument()
  })

  it('starts expanded so notes written for this moment are seen', () => {
    renderView(['Halved the salt.'])
    expect(screen.getByRole('button', { name: /notes/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText('Halved the salt.')).toBeVisible()
  })

  it('hides the notes when toggled shut', async () => {
    const user = userEvent.setup()
    renderView(['Halved the salt.'])
    await user.click(screen.getByRole('button', { name: /notes/i }))
    expect(screen.getByRole('button', { name: /notes/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getByText('Halved the salt.')).not.toBeVisible()
  })

  it('remembers the collapsed choice for that recipe next time', async () => {
    const user = userEvent.setup()
    const view = renderView(['Halved the salt.'])
    await user.click(screen.getByRole('button', { name: /notes/i }))
    view.unmount()

    renderView(['Halved the salt.'])
    expect(screen.getByRole('button', { name: /notes/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('keeps the choice separate per recipe', async () => {
    const user = userEvent.setup()
    const view = renderView(['Halved the salt.'])
    await user.click(screen.getByRole('button', { name: /notes/i }))
    view.unmount()

    // A different dish has its own notes and its own reason to see them.
    render(
      <CookingView
        recipeId="r2"
        title="Soup"
        ingredients={[]}
        steps={['Simmer.']}
        notes={['Use the smaller pot.']}
        lastCookedAt={null}
      />,
    )
    expect(screen.getByRole('button', { name: /notes/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})
