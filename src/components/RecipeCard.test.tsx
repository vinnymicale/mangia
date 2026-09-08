import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecipeCard } from './RecipeCard'

describe('RecipeCard', () => {
  it('shows the total time when the recipe has timings', () => {
    render(<RecipeCard id="r1" title="Chili" prepMinutes={10} cookMinutes={40} />)
    expect(screen.getByText('50m')).toBeInTheDocument()
  })

  it('prefers an explicit subtitle over the time line', () => {
    // Coverage results carry no timings; without this the slot rendered a bare
    // em-dash from formatMinutes(0).
    render(
      <RecipeCard
        id="r1"
        title="Chili"
        prepMinutes={null}
        cookMinutes={null}
        subtitle="3 of 5 ingredients"
      />,
    )
    expect(screen.getByText('3 of 5 ingredients')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })
})
