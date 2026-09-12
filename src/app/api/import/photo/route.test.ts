import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/import/photoImporter', () => ({ importFromPhoto: vi.fn() }))

import { importFromPhoto } from '@/lib/import/photoImporter'
import { POST } from './route'

/**
 * Builds a request whose `formData()` yields exactly the given entry.
 *
 * Neither a real `Request` body nor this environment's `FormData` preserves an
 * uploaded file: a 10MB file round-trips out as nine bytes, and a `File` set
 * on a `FormData` here comes back coerced to a string. The route only ever
 * calls `formData()` and then `.get('photo')`, so standing in for that pair
 * tests the route's own logic rather than the environment's approximations.
 */
function upload(photo: unknown): Request {
  return {
    formData: async () => ({ get: (key: string) => (key === 'photo' ? photo ?? null : null) }),
  } as unknown as Request
}

/**
 * An upload as the route sees one: a type, a size, and bytes on demand.
 *
 * Built by hand rather than with `new File(...)` because this environment's
 * `File` has no `arrayBuffer` -- it predates the method -- while every runtime
 * that actually serves the route does. `size` is stated separately so an
 * oversize file can be tested without allocating ten megabytes.
 */
function upload_(type: string, size: number, bytes = new Uint8Array(size)): unknown {
  return { type, size, arrayBuffer: async () => bytes.buffer }
}

function jpeg(): unknown {
  return upload_('image/jpeg', 16)
}

beforeEach(() => {
  vi.mocked(importFromPhoto).mockReset()
  vi.mocked(importFromPhoto).mockResolvedValue({
    draft: { title: 'Cake' } as never,
    method: 'vision',
  })
})

describe('POST /api/import/photo', () => {
  it('hands the bytes and type to the importer', async () => {
    const response = await POST(upload(jpeg()))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ method: 'vision' })
    const [image, mimeType] = vi.mocked(importFromPhoto).mock.calls[0]
    expect(Buffer.isBuffer(image)).toBe(true)
    expect(mimeType).toBe('image/jpeg')
  })

  it('rejects a request with no file', async () => {
    const response = await POST(upload(undefined))

    expect(response.status).toBe(400)
    expect(importFromPhoto).not.toHaveBeenCalled()
  })

  it('rejects a type no browser can canvas-decode', async () => {
    const response = await POST(upload(upload_('image/heic', 8)))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/JPEG, PNG, or WebP/)
    expect(importFromPhoto).not.toHaveBeenCalled()
  })

  it('rejects a file over the size cap without reading it', async () => {
    const response = await POST(upload(upload_('image/jpeg', 10 * 1024 * 1024 + 1, new Uint8Array(0))))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/10MB/)
    expect(importFromPhoto).not.toHaveBeenCalled()
  })

  it('returns 502 when the engine fails, since the input was fine', async () => {
    vi.mocked(importFromPhoto).mockImplementation(() => {
      throw new Error('That photo could not be read: worker crashed')
    })

    const response = await POST(upload(jpeg()))

    expect(response.status).toBe(502)
    expect((await response.json()).error).toMatch(/could not be read/)
  })
})
