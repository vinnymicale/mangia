import { describe, it, expect, vi } from 'vitest'
import { downloadVideo, MAX_VIDEO_BYTES } from './videoDownload'

/** A run that writes bytes to the output path it was handed, then succeeds. */
function runWriting(bytes: Buffer) {
  return vi.fn(async (_args: string[], outputPath: string) => {
    writes.set(outputPath, bytes)
  })
}

const writes = new Map<string, Buffer>()

function deps(run: (args: string[], outputPath: string) => Promise<void>) {
  return {
    run,
    readFile: async (path: string) => {
      const found = writes.get(path)
      if (!found) throw new Error('ENOENT')
      return found
    },
    cleanup: vi.fn(async () => {}),
  }
}

describe('downloadVideo', () => {
  it('returns the bytes when yt-dlp succeeds', async () => {
    const bytes = Buffer.from('fake mp4')
    const outcome = await downloadVideo(
      'https://www.tiktok.com/@a/video/1',
      deps(runWriting(bytes)),
    )

    expect(outcome).toEqual({ ok: true, data: bytes, mimeType: 'video/mp4' })
  })

  it('reports the binary as unavailable rather than throwing', async () => {
    const run = vi.fn(async () => {
      const error = new Error('spawn yt-dlp ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    })

    expect(await downloadVideo('https://vm.tiktok.com/x/', deps(run))).toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })

  it('reports a timeout distinctly from an ordinary failure', async () => {
    const run = vi.fn(async () => {
      const error = new Error('timed out') as NodeJS.ErrnoException & { killed?: boolean }
      error.killed = true
      throw error
    })

    expect(await downloadVideo('https://vm.tiktok.com/x/', deps(run))).toEqual({
      ok: false,
      reason: 'timeout',
    })
  })

  it('reports a login wall or removed video as failed', async () => {
    const run = vi.fn(async () => {
      throw new Error('ERROR: login required')
    })

    expect(await downloadVideo('https://vm.tiktok.com/x/', deps(run))).toEqual({
      ok: false,
      reason: 'failed',
    })
  })

  it('refuses a file over the cap instead of loading it into a request', async () => {
    const oversize = Buffer.alloc(MAX_VIDEO_BYTES + 1)
    expect(
      await downloadVideo('https://vm.tiktok.com/x/', deps(runWriting(oversize))),
    ).toEqual({ ok: false, reason: 'too-large' })
  })

  it('treats a run that wrote nothing as a failure', async () => {
    const run = vi.fn(async () => {})
    expect(await downloadVideo('https://vm.tiktok.com/x/', deps(run))).toEqual({
      ok: false,
      reason: 'failed',
    })
  })

  it('always cleans up the temp file, including after a failure', async () => {
    const d = deps(
      vi.fn(async () => {
        throw new Error('nope')
      }),
    )
    await downloadVideo('https://vm.tiktok.com/x/', d)
    expect(d.cleanup).toHaveBeenCalledOnce()
  })

  it('rejects a private URL before running the binary', async () => {
    const run = vi.fn(async () => {})
    expect(await downloadVideo('http://127.0.0.1/video', deps(run))).toEqual({
      ok: false,
      reason: 'failed',
    })
    expect(run).not.toHaveBeenCalled()
  })

  it('passes the url last and never through a shell', async () => {
    const run = vi.fn(async (_args: string[], outputPath: string) => {
      writes.set(outputPath, Buffer.from('x'))
    })
    await downloadVideo('https://vm.tiktok.com/x/', deps(run))

    const args = run.mock.calls[0][0]
    expect(args.at(-1)).toBe('https://vm.tiktok.com/x/')
    // A size cap enforced by yt-dlp itself, so an oversize download aborts
    // early rather than filling the disk and failing the check afterwards.
    expect(args).toContain('--max-filesize')
  })
})
