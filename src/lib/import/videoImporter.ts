import { getProvider } from '@/lib/llm'
import { classifyUrl, type VideoPlatform } from './videoUrl'
import { fetchVideoMetadata, type VideoMetadata } from './videoMetadata'
import { downloadVideo as defaultDownloadVideo, type DownloadOutcome } from './videoDownload'
import { isEmptyDraft } from './emptyDraft'
import type { LlmProvider, RecipeDraft } from '@/lib/llm/types'

export interface VideoImportResult {
  draft: RecipeDraft
  /** Which rung of the ladder produced the draft, so the form can say so. */
  method: 'video-caption' | 'video-model'
  sourceUrl: string
}

export interface VideoImportDeps {
  /** `null` means "no provider configured"; omitted means "resolve one". */
  provider?: LlmProvider | null
  fetchMetadata?: (url: string, platform: VideoPlatform) => Promise<VideoMetadata>
  downloadVideo?: (url: string) => Promise<DownloadOutcome>
}

/**
 * Below this, a caption is a teaser rather than a recipe -- a title and a
 * couple of hashtags. A caption that names three ingredients with amounts and
 * sketches the method clears it, which is the shortest thing worth parsing.
 */
const MIN_CAPTION_CHARS = 120

/**
 * A caption worth parsing names amounts. "Best carbonara ever, recipe below!"
 * is long enough to pass a length test and contains nothing to extract, so a
 * digit somewhere is required too.
 */
function isSubstantialCaption(caption: string): boolean {
  return caption.length >= MIN_CAPTION_CHARS && /\d/.test(caption)
}

/** Gives the model the title and author as context around the caption body. */
function captionDocument(meta: VideoMetadata): string {
  return [
    meta.title ? `Title: ${meta.title}` : null,
    meta.author ? `By: ${meta.author}` : null,
    '',
    meta.caption,
  ]
    .filter((line) => line !== null)
    .join('\n')
}

/** See photoImporter: an absent key selects a different path, not an error. */
async function resolveProvider(deps: VideoImportDeps): Promise<LlmProvider | null> {
  if (deps.provider !== undefined) return deps.provider
  try {
    return await getProvider()
  } catch {
    return null
  }
}

/**
 * The video was fetched and read, and held no recipe. Distinct from a download
 * failure: nothing went wrong technically, there was just nothing there.
 */
const EMPTY_VIDEO_FAILURE = 'the video was read but no recipe could be found in it'

const DOWNLOAD_MESSAGES: Record<Exclude<DownloadOutcome, { ok: true }>['reason'], string> = {
  unavailable: 'yt-dlp is not installed, so the video itself could not be read',
  failed: 'the video could not be downloaded, which usually means it is private or login-walled',
  'too-large': 'the video is too large to send to the model',
  timeout: 'the download timed out',
}

/**
 * Reads a recipe out of a cooking video, cheapest source first.
 *
 * The ladder is caption, then video. A caption that already lists amounts is
 * both faster and more accurate than any transcription, and most recipe posts
 * have one; watching the video is reserved for the posts that do not.
 *
 * YouTube goes to the model as a URL -- Gemini fetches it itself -- while
 * Instagram and TikTok have to be pulled down with yt-dlp and sent as bytes.
 */
export async function importFromVideo(
  url: string,
  deps: VideoImportDeps = {},
): Promise<VideoImportResult> {
  const classified = classifyUrl(url)
  if (classified.kind !== 'video') {
    throw new Error(`That is not a supported video URL: ${url}`)
  }
  const { platform } = classified

  const provider = await resolveProvider(deps)
  if (provider === null) {
    throw new Error('No model is configured, and a video cannot be read without one.')
  }

  const fetchMetadata = deps.fetchMetadata ?? fetchVideoMetadata
  const download = deps.downloadVideo ?? defaultDownloadVideo

  // Never throws by contract, but a dependency injected by a caller might.
  const meta = await fetchMetadata(url, platform).catch(
    (): VideoMetadata => ({ title: null, caption: '', author: null }),
  )

  if (isSubstantialCaption(meta.caption)) {
    try {
      const draft = await provider.extractRecipe(captionDocument(meta))
      // An empty draft is a rung that did not pay off, exactly like a throw.
      // Returning one is how an import came back blank and still reported
      // success, so it falls through to the video instead.
      if (!isEmptyDraft(draft)) {
        return { draft, method: 'video-caption', sourceUrl: url }
      }
    } catch {
      // Deliberately swallowed: the video is the better source anyway, and
      // this only means the shortcut did not pay off.
    }
  }

  // Why the failure is remembered rather than thrown: a thin caption is still
  // worth a try once the video has been ruled out, and if that fails too this
  // is the message that explains what actually went wrong.
  let videoFailure: string
  try {
    if (platform === 'youtube') {
      const draft = await provider.extractRecipeFromVideo({ kind: 'url', url })
      if (!isEmptyDraft(draft)) {
        return { draft, method: 'video-model', sourceUrl: url }
      }
      videoFailure = EMPTY_VIDEO_FAILURE
    } else {
      const outcome = await download(url)
      if (!outcome.ok) {
        videoFailure = DOWNLOAD_MESSAGES[outcome.reason]
      } else {
        const draft = await provider.extractRecipeFromVideo({
          kind: 'bytes',
          data: outcome.data,
          mimeType: outcome.mimeType,
        })
        if (!isEmptyDraft(draft)) {
          return { draft, method: 'video-model', sourceUrl: url }
        }
        videoFailure = EMPTY_VIDEO_FAILURE
      }
    }
  } catch (error) {
    videoFailure = error instanceof Error ? error.message : String(error)
  }

  // Last resort: a caption too thin to prefer still beats nothing at all.
  if (meta.caption.trim() !== '') {
    try {
      const draft = await provider.extractRecipe(captionDocument(meta))
      if (!isEmptyDraft(draft)) {
        return { draft, method: 'video-caption', sourceUrl: url }
      }
    } catch {
      // Falls through to the video failure, which is the more useful message.
    }
  }

  throw new Error(`That video could not be read: ${videoFailure}`)
}
