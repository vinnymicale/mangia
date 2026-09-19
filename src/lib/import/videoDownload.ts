import { execFile } from 'node:child_process'
import { readFile as fsReadFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { assertPublicHost, assertWebUrl } from './fetchGuard'

const execFileAsync = promisify(execFile)

/** Roughly a few minutes of phone-shot cooking video, and well under a request body cap. */
export const MAX_VIDEO_BYTES = 64 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 90_000

export type DownloadOutcome =
  | { ok: true; data: Buffer; mimeType: string }
  | { ok: false; reason: 'unavailable' | 'failed' | 'too-large' | 'timeout' }

export interface VideoDownloadDeps {
  run?: (args: string[], outputPath: string) => Promise<void>
  readFile?: (path: string) => Promise<Buffer>
  cleanup?: (path: string) => Promise<void>
}

/**
 * The format selector deliberately asks for a single progressive MP4 under
 * 720p. Anything else would need ffmpeg to merge separate video and audio
 * streams, and the image ships without it -- a 4K download is also far more
 * bytes than reading a recipe ever justifies.
 */
function ytDlpArgs(url: string, outputPath: string): string[] {
  return [
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    // Both caps are enforced by yt-dlp itself so an oversize or slow download
    // aborts during transfer rather than after filling the disk.
    '--max-filesize',
    String(MAX_VIDEO_BYTES),
    '--socket-timeout',
    '30',
    '-f',
    'best[ext=mp4][height<=720]/best[ext=mp4]/best',
    '-o',
    outputPath,
    // Last, and only ever as an argv entry -- never interpolated into a shell.
    url,
  ]
}

async function defaultRun(args: string[]): Promise<void> {
  await execFileAsync('yt-dlp', args, {
    timeout: DOWNLOAD_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  })
}

function classify(error: unknown): DownloadOutcome {
  const err = error as NodeJS.ErrnoException & { killed?: boolean }
  // No binary in the image, or not on PATH.
  if (err?.code === 'ENOENT') return { ok: false, reason: 'unavailable' }
  // execFile kills the child on timeout and flags it.
  if (err?.killed) return { ok: false, reason: 'timeout' }
  return { ok: false, reason: 'failed' }
}

/**
 * Pulls a video down with yt-dlp so it can be handed to a model as bytes.
 *
 * Returns an outcome rather than throwing. "No yt-dlp on this box" is an
 * ordinary state the import ladder plans for -- the binary is bundled but the
 * feature degrades without it -- not an exception worth unwinding for.
 */
export async function downloadVideo(
  url: string,
  deps: VideoDownloadDeps = {},
): Promise<DownloadOutcome> {
  const run = deps.run ?? defaultRun
  const readFile = deps.readFile ?? fsReadFile
  const cleanup = deps.cleanup ?? ((path: string) => rm(path, { force: true }))

  // yt-dlp does its own fetching, so it bypasses guardedFetch entirely. The
  // host check has to happen here or a private URL would reach the network.
  try {
    await assertPublicHost(assertWebUrl(url))
  } catch {
    return { ok: false, reason: 'failed' }
  }

  const outputPath = join(tmpdir(), `mangia-video-${randomUUID()}.mp4`)

  try {
    await run(ytDlpArgs(url, outputPath), outputPath)

    let data: Buffer
    try {
      data = await readFile(outputPath)
    } catch {
      // yt-dlp exits 0 having written nothing when --max-filesize trips.
      return { ok: false, reason: 'failed' }
    }

    if (data.byteLength === 0) return { ok: false, reason: 'failed' }
    if (data.byteLength > MAX_VIDEO_BYTES) return { ok: false, reason: 'too-large' }

    return { ok: true, data, mimeType: 'video/mp4' }
  } catch (error) {
    return classify(error)
  } finally {
    await cleanup(outputPath).catch(() => {})
  }
}
