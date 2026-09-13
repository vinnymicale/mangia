import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhotoImportTab } from './PhotoImportTab'

const DRAFT = {
  title: 'Nonna Card',
  description: null,
  instructions: '1. Cook.',
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  notes: 'Half the page was unreadable.',
  tags: [],
  ingredients: [
    {
      quantity: 2, unit: 'cups', ingredient: 'flour',
      note: null, rawText: '2 cups flour', confidence: 'low',
    },
  ],
}

function stubFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  // jsdom has no canvas encoder, so `downscale` falls back to the original
  // file. That is the documented behaviour, not a test-only shortcut.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:preview'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => vi.unstubAllGlobals())

function pick() {
  return new File([new Uint8Array([1, 2, 3])], 'card.jpg', { type: 'image/jpeg' })
}

describe('PhotoImportTab', () => {
  it('cannot be submitted before a photo is chosen', () => {
    render(<PhotoImportTab onParsed={vi.fn()} />)
    expect(screen.getByRole('button', { name: /read photo/i })).toBeDisabled()
  })

  it('defaults the keep-the-photo toggle to off', () => {
    render(<PhotoImportTab onParsed={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /keep the original/i })).not.toBeChecked()
  })

  it('hands the parsed draft over, photoless by default', async () => {
    stubFetch({ draft: DRAFT, method: 'ocr', rawText: 'Nonna Card' })
    const onParsed = vi.fn()
    render(<PhotoImportTab onParsed={onParsed} />)

    await userEvent.upload(screen.getByLabelText(/recipe photo/i), pick())
    await userEvent.click(screen.getByRole('button', { name: /read photo/i }))

    await waitFor(() => expect(onParsed).toHaveBeenCalledOnce())
    const outcome = onParsed.mock.calls[0][0]
    expect(outcome.method).toBe('ocr')
    expect(outcome.value.title).toBe('Nonna Card')
    // What OCR could not place still reaches the cook, in the notes field.
    expect(outcome.value.notes).toBe('Half the page was unreadable.')
    expect(outcome.value.ingredients[0].confidence).toBe('low')
    expect(outcome.value.photo).toBeNull()
  })

  it('carries the photo on the value when the toggle is on', async () => {
    stubFetch({ draft: DRAFT, method: 'vision' })
    const onParsed = vi.fn()
    render(<PhotoImportTab onParsed={onParsed} />)

    await userEvent.upload(screen.getByLabelText(/recipe photo/i), pick())
    await userEvent.click(screen.getByRole('checkbox', { name: /keep the original/i }))
    await userEvent.click(screen.getByRole('button', { name: /read photo/i }))

    await waitFor(() => expect(onParsed).toHaveBeenCalledOnce())
    const photo = onParsed.mock.calls[0][0].value.photo
    expect(photo.mimeType).toBe('image/jpeg')
    expect(photo.data).toBe(Buffer.from([1, 2, 3]).toString('base64'))
  })

  it('uploads under the field name the route reads', async () => {
    const fetchMock = stubFetch({ draft: DRAFT, method: 'vision' })
    render(<PhotoImportTab onParsed={vi.fn()} />)

    await userEvent.upload(screen.getByLabelText(/recipe photo/i), pick())
    await userEvent.click(screen.getByRole('button', { name: /read photo/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const body = fetchMock.mock.calls[0][1].body as FormData
    expect(body.get('photo')).not.toBeNull()
  })

  it('shows the server error in an alert', async () => {
    stubFetch({ error: 'That photo could not be read.' }, false, 502)
    render(<PhotoImportTab onParsed={vi.fn()} />)

    await userEvent.upload(screen.getByLabelText(/recipe photo/i), pick())
    await userEvent.click(screen.getByRole('button', { name: /read photo/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/could not be read/i),
    )
  })

  it('rejects an unsupported type before spending an upload on it', async () => {
    const fetchMock = stubFetch({})
    render(<PhotoImportTab onParsed={vi.fn()} />)

    // Fired directly rather than through `upload`: the picker honours the
    // `accept` list and would never hand this file over, but a drag-drop or a
    // file whose name lies about it can still reach the handler.
    const input = screen.getByLabelText(/recipe photo/i) as HTMLInputElement
    const gif = new File([new Uint8Array([1])], 'x.gif', { type: 'image/gif' })
    Object.defineProperty(input, 'files', { value: [gif] })
    fireEvent.change(input)

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/JPEG/i))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /read photo/i })).toBeDisabled()
  })
})
