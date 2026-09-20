import * as cheerio from 'cheerio'
import { extractJsonLdRecipe } from './jsonld'
import { assertWebUrl, guardedFetch } from './fetchGuard'
import { isEmptyDraft } from './emptyDraft'
import { getProvider } from '@/lib/llm'
import type { LlmProvider, RecipeDraft } from '@/lib/llm/types'

// Re-exported because the SSRF guard used to live here, and both this importer
// and the video one now share the single copy in fetchGuard.
export { isPrivateAddress } from './fetchGuard'

export interface ImportResult {
  draft: RecipeDraft
  method: 'jsonld' | 'llm'
  sourceUrl: string
}

export interface ImportDeps {
  fetchHtml?: (url: string) => Promise<string>
  provider?: LlmProvider
}

/** Model context is finite; recipe pages carry a lot of unrelated prose. */
const MAX_TEXT_CHARS = 24000

/** Reduces a page to readable text for the model. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, noscript, svg, nav, footer, header').remove()
  return $.root()
    .text()
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n')
}

async function defaultFetchHtml(url: string): Promise<string> {
  const response = await guardedFetch(url)
  return response.text()
}

export async function importFromUrl(
  url: string,
  deps: ImportDeps = {},
): Promise<ImportResult> {
  assertWebUrl(url)

  const fetchHtml = deps.fetchHtml ?? defaultFetchHtml

  let html: string
  try {
    html = await fetchHtml(url)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not fetch ${url}: ${detail}`)
  }

  const structured = extractJsonLdRecipe(html)
  // A `Recipe` block needs only a name to parse, and sites that stamp the
  // markup on every page produce plenty with nothing else in them. The prose
  // may still hold the recipe, so an empty block defers to the model.
  if (structured && !isEmptyDraft(structured)) {
    return { draft: structured, method: 'jsonld', sourceUrl: url }
  }

  const provider = deps.provider ?? (await getProvider())
  const text = htmlToText(html).slice(0, MAX_TEXT_CHARS)
  const draft = await provider.extractRecipe(text)
  // The last rung. Returning an empty draft here is how an import came back
  // blank and still reported success, leaving the user a form and no reason.
  if (isEmptyDraft(draft)) {
    throw new Error(`No recipe could be found in ${url}.`)
  }
  return { draft, method: 'llm', sourceUrl: url }
}
