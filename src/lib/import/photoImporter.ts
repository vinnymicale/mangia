import { getProvider } from '@/lib/llm'
import { runOcr as defaultRunOcr } from '@/lib/ocr/tesseract'
import { structureOcrText, type OcrDraft } from './ocrStructure'
import type { LlmProvider } from '@/lib/llm/types'

export interface PhotoImportResult {
  draft: OcrDraft
  method: 'vision' | 'ocr'
  /** Present only for OCR, so the user can see what the engine actually read. */
  rawText?: string
}

export interface PhotoImportDeps {
  /** `null` means "no provider configured"; omitted means "resolve one". */
  provider?: LlmProvider | null
  runOcr?: (image: Buffer) => Promise<string>
}

/**
 * Resolves the configured provider, or null when there is none.
 *
 * `getProvider` throws on a missing key by design -- every other caller wants
 * that -- but here an absent key is the ordinary case that selects OCR, not an
 * error worth surfacing.
 */
async function resolveProvider(deps: PhotoImportDeps): Promise<LlmProvider | null> {
  if (deps.provider !== undefined) return deps.provider
  try {
    return await getProvider()
  } catch {
    return null
  }
}

/** Fills the fields a `RecipeDraft` has and an `OcrDraft` adds. */
function withNotes(draft: Awaited<ReturnType<LlmProvider['extractRecipeFromImage']>>): OcrDraft {
  return {
    ...draft,
    notes: null,
    // The model returns plain draft ingredients. Rows from a photo keep their
    // own line and a confidence the review table can flag, the same as OCR's.
    ingredients: draft.ingredients.map((row) => ({
      ...row,
      rawText: [row.quantity, row.unit, row.ingredient].filter(Boolean).join(' '),
      confidence: 'low' as const,
    })),
  }
}

/**
 * Reads a recipe out of a photo: the vision model first, local OCR second.
 *
 * The fallback covers both a missing key and a vision call that failed --
 * a text-only local model, a rate limit, an outage. None of those should
 * dead-end an upload when there is a working engine on the box.
 */
export async function importFromPhoto(
  image: Buffer,
  mimeType: string,
  deps: PhotoImportDeps = {},
): Promise<PhotoImportResult> {
  const provider = await resolveProvider(deps)

  if (provider !== null) {
    try {
      const draft = await provider.extractRecipeFromImage(image, mimeType)
      return { draft: withNotes(draft), method: 'vision' }
    } catch {
      // Deliberately swallowed: falling back to OCR is the designed response,
      // and a user who gets a usable draft does not need to hear about it.
    }
  }

  const runOcr = deps.runOcr ?? defaultRunOcr
  let text: string
  try {
    text = await runOcr(image)
  } catch (error) {
    // OCR is the last resort, so its failure is the one the user must see.
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`That photo could not be read: ${detail}`)
  }

  return { draft: structureOcrText(text), method: 'ocr', rawText: text }
}
