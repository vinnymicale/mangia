import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiSettingsPanel } from './AiSettingsPanel'
import type { DescribedConfig } from '@/lib/config'

function llm(overrides: Partial<DescribedConfig['llm']> = {}): DescribedConfig['llm'] {
  return {
    provider: { value: 'gemini', source: 'default' },
    apiKey: { set: true, mask: '••••••••1234', source: 'db' },
    model: { value: 'gemini-2.5-flash', source: 'default' },
    baseUrl: { value: null, source: 'unset' },
    ...overrides,
  }
}

/** The body of the single PUT the panel sent. */
function sentSettings(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0]
  return JSON.parse(init.body).settings
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ llm: llm(), drive: {} }),
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('AiSettingsPanel', () => {
  it('shows the mask rather than any key material', () => {
    render(<AiSettingsPanel initial={llm()} />)
    expect(screen.getByText('••••••••1234')).toBeInTheDocument()
  })

  // The security property the whole masked-field design exists to guarantee:
  // a key the user never touched is absent from the update, so the route's
  // "absent means leave alone" rule protects the stored value.
  it('leaves an untouched key out of the update entirely', async () => {
    render(<AiSettingsPanel initial={llm()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect('llm.apiKey' in sentSettings(fetchMock)).toBe(false)
  })

  it('sends a replacement key once one is typed', async () => {
    render(<AiSettingsPanel initial={llm()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }))
    await userEvent.type(screen.getByLabelText('API key'), 'sk-new')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(sentSettings(fetchMock)['llm.apiKey']).toBe('sk-new')
  })

  // Backing out of a replacement must restore the mask without having staged
  // anything -- otherwise Cancel would silently clear the key on the next save.
  it('restores the mask on cancel without submitting a key', async () => {
    render(<AiSettingsPanel initial={llm()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }))
    await userEvent.type(screen.getByLabelText('API key'), 'typed-then-abandoned')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('••••••••1234')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect('llm.apiKey' in sentSettings(fetchMock)).toBe(false)
  })

  it('asks for a base URL only when the provider needs one', async () => {
    render(<AiSettingsPanel initial={llm()} />)
    expect(screen.queryByLabelText('Base URL')).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Provider'), 'openai-compatible')
    expect(screen.getByLabelText('Base URL')).toBeInTheDocument()
  })
})
