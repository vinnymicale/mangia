import { readFile } from 'node:fs/promises'
import { createSign } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const FILES_URL = 'https://www.googleapis.com/drive/v3/files'

/**
 * drive.file, not drive: the service account can only touch files it created
 * itself. A backup job has no business being able to read the rest of a Drive.
 */
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

/** What the settings page is allowed to see. Deliberately holds no secret. */
export interface DriveConfig {
  configured: boolean
  clientEmail: string | null
  folderId: string | null
  intervalHours: number
  /** Set when credentials were supplied but cannot be used, so the user can fix it. */
  problem: string | null
}

interface ServiceAccountKey {
  client_email: string
  private_key: string
}

/**
 * Credentials live on disk and are named by an environment variable rather than
 * being pasted into the app: the file never enters the database, never reaches
 * a page, and is removed by deleting it. Backups are off until it exists, so an
 * installation that never sets this is unaffected by any of this code.
 */
async function loadKey(): Promise<ServiceAccountKey | { problem: string } | null> {
  const path = process.env.GOOGLE_DRIVE_CREDENTIALS?.trim()
  if (!path) return null

  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    return { problem: `The credentials file at ${path} could not be read.` }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccountKey>
    if (typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') {
      return { problem: 'That file is not a Google service account key.' }
    }
    return { client_email: parsed.client_email, private_key: parsed.private_key }
  } catch {
    return { problem: 'That file is not a Google service account key.' }
  }
}

/** Hours between automatic backups. Never zero: that would busy-loop the timer. */
export function backupIntervalHours(): number {
  const raw = Number(process.env.GOOGLE_DRIVE_BACKUP_INTERVAL_HOURS)
  if (!Number.isFinite(raw) || raw <= 0) return 24
  return raw
}

export async function readDriveConfig(): Promise<DriveConfig> {
  const key = await loadKey()
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || null
  const intervalHours = backupIntervalHours()

  if (key === null) {
    return { configured: false, clientEmail: null, folderId, intervalHours, problem: null }
  }
  if ('problem' in key) {
    return { configured: false, clientEmail: null, folderId, intervalHours, problem: key.problem }
  }
  return {
    configured: true,
    clientEmail: key.client_email,
    folderId,
    intervalHours,
    problem: null,
  }
}

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
export async function uploadBackup(contents: string, name: string): Promise<UploadResult> {
  const key = await loadKey()
  if (key === null) throw new Error('Google Drive backups are not configured.')
  if ('problem' in key) throw new Error(key.problem)

  const token = await accessToken(key)
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()

  // A service account owns no personal Drive quota, so without a shared folder
  // to write into the upload fails with a confusing storage error. Say so here.
  if (!folderId) {
    throw new Error(
      'Set GOOGLE_DRIVE_FOLDER_ID to a Drive folder shared with the service account.',
    )
  }

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
export async function pruneBackups(keep: number): Promise<number> {
  const key = await loadKey()
  if (key === null || 'problem' in key) return 0
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()
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
