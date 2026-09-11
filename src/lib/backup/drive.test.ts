import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { uploadBackup, pruneBackups, type ServiceAccountKey } from './drive'

/**
 * A real (throwaway) RSA key, because the JWT assertion is genuinely signed and
 * a placeholder string would make `createSign` throw before any of the request
 * shaping under test could run.
 */
const key: ServiceAccountKey = {
  client_email: 'backups@example.iam.gserviceaccount.com',
  private_key: generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey,
}

/** Every request the module made, in order, for assertions after the fact. */
let calls: { url: string; init: RequestInit | undefined }[]

function respond(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response
}

beforeEach(() => {
  calls = []
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Answers the token exchange, then defers to `handler` for the real request. */
function stubFetch(handler: (url: string, init?: RequestInit) => Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init })
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        return respond({ access_token: 'token-123' })
      }
      return handler(url, init)
    }),
  )
}

describe('uploadBackup', () => {
  it('refuses to upload without a folder id', async () => {
    stubFetch(() => respond({}))
    await expect(uploadBackup(key, null, '{}', 'backup.json')).rejects.toThrow(/folder id/i)
    // Not even a token was fetched: the check happens before any network call.
    expect(calls).toHaveLength(0)
  })

  it('uploads into the configured folder and reports the stored name', async () => {
    stubFetch(() => respond({ id: 'file-1', name: 'backup.json' }))

    const result = await uploadBackup(key, 'folder-9', '{"recipes":[]}', 'backup.json')

    expect(result).toEqual({ fileId: 'file-1', name: 'backup.json', bytes: 14 })
    const upload = calls[1]
    expect(upload.url).toContain('uploadType=multipart')
    expect(upload.init?.headers).toMatchObject({ authorization: 'Bearer token-123' })
    expect(String(upload.init?.body)).toContain('"parents":["folder-9"]')
  })

  it('surfaces the message Google returned', async () => {
    stubFetch(() => respond({ error: { message: 'File not found: folder-9.' } }, false))
    await expect(uploadBackup(key, 'folder-9', '{}', 'backup.json')).rejects.toThrow(
      'File not found: folder-9.',
    )
  })

  /**
   * The sibling of the private-key assertion in config.test.ts, at the other
   * end of the path. The key is signed with, never sent: a bug that put it in a
   * request body would ship the credential to Google's upload endpoint in
   * plaintext, and no type would catch it.
   */
  it('never puts the private key in a request', async () => {
    stubFetch(() => respond({ id: 'file-1', name: 'backup.json' }))
    await uploadBackup(key, 'folder-9', '{}', 'backup.json')

    for (const call of calls) {
      expect(JSON.stringify(call)).not.toContain('BEGIN PRIVATE KEY')
    }
  })
})

describe('pruneBackups', () => {
  it('deletes only the archives past the keep count', async () => {
    stubFetch((url) => {
      if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
        return respond({ files: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] })
      }
      return respond({})
    })

    expect(await pruneBackups(key, 'folder-9', 2)).toBe(2)
    const deletes = calls.filter((call) => call.init?.method === 'DELETE')
    // Newest first, so the two swept are the oldest of the four.
    expect(deletes.map((call) => call.url.split('/').pop())).toEqual(['c', 'd'])
  })

  it('does nothing when no folder is configured', async () => {
    stubFetch(() => respond({}))
    expect(await pruneBackups(key, null, 2)).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it('gives up quietly when the listing fails', async () => {
    stubFetch(() => respond({}, false))
    expect(await pruneBackups(key, 'folder-9', 2)).toBe(0)
  })
})
