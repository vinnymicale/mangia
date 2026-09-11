import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackupSettingsPanel } from './BackupSettingsPanel'
import type { DescribedConfig } from '@/lib/config'

function drive(overrides: Partial<DescribedConfig['drive']> = {}): DescribedConfig['drive'] {
  return {
    // The Drive key's mask is the service account's address, not a tail: it is
    // the part the user has to share the folder with.
    credentials: { set: true, mask: 'mangia@example.iam.gserviceaccount.com', source: 'db' },
    folderId: { value: 'folder-1', source: 'db' },
    intervalHours: { value: 24, source: 'default' },
    keepCount: { value: 14, source: 'default' },
    problem: null,
    configured: true,
    ...overrides,
  }
}

function sentSettings(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0]
  return JSON.parse(init.body).settings
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ llm: {}, drive: drive() }),
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('BackupSettingsPanel', () => {
  it('identifies the installed service account by its address', () => {
    render(<BackupSettingsPanel initial={drive()} initialRun={null} />)
    expect(screen.getByText('mangia@example.iam.gserviceaccount.com')).toBeInTheDocument()
  })

  it('leaves untouched credentials out of the update', async () => {
    render(<BackupSettingsPanel initial={drive()} initialRun={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect('drive.credentials' in sentSettings(fetchMock)).toBe(false)
  })

  it('saves a changed interval and retention', async () => {
    render(<BackupSettingsPanel initial={drive()} initialRun={null} />)
    await userEvent.clear(screen.getByLabelText('Back up every'))
    await userEvent.type(screen.getByLabelText('Back up every'), '6')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    const settings = sentSettings(fetchMock)
    expect(settings['drive.intervalHours']).toBe('6')
    expect(settings['drive.keepCount']).toBe('14')
  })

  it('offers the key file picker rather than a text box for the key', async () => {
    render(<BackupSettingsPanel initial={drive({ credentials: { set: false, mask: null, source: 'unset' } })} initialRun={null} />)
    expect(screen.getByRole('button', { name: 'Choose key file' })).toBeInTheDocument()
  })

  it('cannot back up now while Drive is unconfigured', () => {
    render(
      <BackupSettingsPanel
        initial={drive({ configured: false, problem: 'No key is set.' })}
        initialRun={null}
      />,
    )
    expect(screen.getByRole('button', { name: /Back up now/ })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('No key is set.')
  })

  it('reports a previous failed run', () => {
    render(
      <BackupSettingsPanel
        initial={drive()}
        initialRun={{ at: '2026-09-10T12:00:00.000Z', ok: false, detail: 'Drive refused it.' }}
      />,
    )
    expect(screen.getByText(/failed — Drive refused it\./)).toBeInTheDocument()
  })
})
