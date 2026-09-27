import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NutritionSettingsPanel } from './NutritionSettingsPanel'
import type { DescribedConfig } from '@/lib/config'

const UNSET: DescribedConfig['usda'] = { apiKey: { set: false, mask: null, source: 'unset' } }
const SET: DescribedConfig['usda'] = { apiKey: { set: true, mask: '••••••••wxyz', source: 'db' } }

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ usda: SET }) })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('NutritionSettingsPanel', () => {
  it('says the demo key is used when none is set', () => {
    render(<NutritionSettingsPanel initial={UNSET} />)
    expect(screen.getByText(/demo key is used, limited to 30 requests an hour/)).toBeInTheDocument()
  })

  it('saves a new key and shows its mask', async () => {
    render(<NutritionSettingsPanel initial={UNSET} />)
    await userEvent.type(screen.getByLabelText('USDA API key'), 'new-key-wxyz')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body).settings).toEqual({ 'usda.apiKey': 'new-key-wxyz' })
    expect(await screen.findByText('••••••••wxyz')).toBeInTheDocument()
  })

  it('clears a stored key with an explicit null', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ usda: UNSET }) })
    render(<NutritionSettingsPanel initial={SET} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body).settings).toEqual({ 'usda.apiKey': null })
  })

  it('runs the usda connection test', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, detail: 'Answered.' }) })
    render(<NutritionSettingsPanel initial={SET} />)
    await userEvent.click(screen.getByRole('button', { name: /Test connection/ }))

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/settings/test')
    expect(JSON.parse(init.body)).toEqual({ target: 'usda' })
    expect(await screen.findByText('Answered.')).toBeInTheDocument()
  })
})
