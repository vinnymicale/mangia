import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// The empty state used to be an e2e assertion, but the shared e2e database is
// seeded by other specs, so "no recipes exist" is only testable in isolation.
vi.mock('@/lib/db/client', () => ({
  db: { tag: { findMany: vi.fn().mockResolvedValue([]) } },
}))
vi.mock('@/lib/db/recipes', () => ({ listRecipes: vi.fn() }))
// BrowseControls is a client component; outside a router its hooks throw.
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the empty state when no recipes exist and no filters are applied', async () => {
    const { listRecipes } = await import('@/lib/db/recipes')
    vi.mocked(listRecipes).mockResolvedValue([])
    const HomePage = (await import('./page')).default

    render(await HomePage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('heading', { name: 'No recipes yet' })).toBeTruthy()
  })

  it('shows the no-match message instead when a filter is applied', async () => {
    const { listRecipes } = await import('@/lib/db/recipes')
    vi.mocked(listRecipes).mockResolvedValue([])
    const HomePage = (await import('./page')).default

    render(await HomePage({ searchParams: Promise.resolve({ tag: 'weeknight' }) }))

    expect(screen.queryByRole('heading', { name: 'No recipes yet' })).toBeNull()
    expect(screen.getByText('Nothing matches those filters.')).toBeTruthy()
  })
})
