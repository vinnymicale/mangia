import { createSign } from 'node:crypto'
import type { ServiceAccountKey } from '@/lib/config'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const FILES_URL = 'https://www.googleapis.com/drive/v3/files'

/**
 * drive.file, not drive: the service account can only touch files it created
 * itself. A backup job has no business being able to read the rest of a Drive.
 */
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

/**
 * Everything below takes an already-resolved service account key rather than
 * reading one. Where credentials come from -- a row written by the settings
 * page or a file named by the environment -- is `lib/config.ts`'s business, and
 * keeping that out of here is what lets a key change take effect immediately.
 *
 * The original reasoning for the env-var-only design was that the key "never
 * enters the database, never reaches a page." The second half still holds and
 * is enforced below and in config.ts: no caller here ever returns the private
 * key. The first half is deliberately given up, because making the key editable
 * from the UI is the point, and a SQLite file is not a weaker home for it than
 * a key file on the same disk.
 */
export type { ServiceAccountKey } from '@/lib/config'

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Signs the JWT bearer assertion Google exchanges for an access token. Doing
 * this with node:crypto rather than pulling in googleapis keeps a very large
 * dependency out of a self-hosted app for what is one signature and two fetches.
 */
function assertion(key: ServiceAccountKey): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  return `${header}.${claims}.${base64url(signer.sign(key.private_key))}`
}

async function accessToken(key: ServiceAccountKey): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertion(key),
    }),
  })
  const body = (await response.json()) as { access_token?: string; error_description?: string }
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? 'Google rejected the service account credentials.')
  }
  return body.access_token
}

export interface UploadResult {
  fileId: string
  name: string
  bytes: number
}

/**
 * Uploads one JSON archive. Multipart rather than resumable: a recipe box is
 * kilobytes, and resumable uploads would add a round trip and a failure mode
 * for no benefit at this size.
 */
export async function uploadBackup(
  key: ServiceAccountKey,
  folderId: string | null,
  contents: string,
  name: string,
): Promise<UploadResult> {
  // A service account owns no personal Drive quota, so without a shared folder
  // to write into the upload fails with a confusing storage error. Say so here.
  if (!folderId) {
    throw new Error(
      'Set a Drive folder id under Settings. The folder must be shared with the service account.',
    )
  }

  const token = await accessToken(key)

  const boundary = `mangia-${Date.now()}`
  const metadata = JSON.stringify({ name, parents: [folderId] })
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    contents,
    `--${boundary}--`,
    '',
  ].join('\r\n')

  const response = await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id,name`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  const result = (await response.json()) as {
    id?: string
    name?: string
    error?: { message?: string }
  }
  if (!response.ok || !result.id) {
    throw new Error(result.error?.message ?? 'Google Drive refused the upload.')
  }

  return { fileId: result.id, name: result.name ?? name, bytes: Buffer.byteLength(contents) }
}

/**
 * Deletes the oldest archives beyond `keep`. Without this a daily backup grows
 * without bound; only files this service account created are visible to it, so
 * nothing else in the folder can be caught by the sweep.
 */
export async function pruneBackups(
  key: ServiceAccountKey,
  folderId: string | null,
  keep: number,
): Promise<number> {
  if (!folderId) return 0

  const token = await accessToken(key)
  const query = new URLSearchParams({
    q: `'${folderId}' in parents and name contains 'mangia-backup' and trashed = false`,
    orderBy: 'createdTime desc',
    fields: 'files(id,name)',
    pageSize: '200',
  })
  const response = await fetch(`${FILES_URL}?${query}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) return 0

  const { files = [] } = (await response.json()) as { files?: { id: string }[] }
  const doomed = files.slice(keep)
  for (const file of doomed) {
    await fetch(`${FILES_URL}/${file.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
  }
  return doomed.length
}

/**
 * Proves the credentials and the folder actually work, without writing
 * anything. Exchanging the assertion for a token checks the key; fetching the
 * folder's metadata checks that the id is real and that the service account
 * has been given access to it -- which is the step users most often miss,
 * because sharing happens in Drive's UI and nothing in Mangia can do it.
 */
export async function checkAccess(
  key: ServiceAccountKey,
  folderId: string | null,
): Promise<string> {
  const token = await accessToken(key)
  if (!folderId) {
    throw new Error('Set a Drive folder id. The folder must be shared with the service account.')
  }

  const response = await fetch(`${FILES_URL}/${folderId}?fields=id,name`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const body = (await response.json()) as { name?: string; error?: { message?: string } }
  if (!response.ok || !body.name) {
    throw new Error(
      body.error?.message ??
        'That folder could not be opened. Check the id, and that it is shared with the service account.',
    )
  }
  return body.name
}
