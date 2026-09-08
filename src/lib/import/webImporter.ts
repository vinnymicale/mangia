import * as cheerio from 'cheerio'
import { extractJsonLdRecipe } from './jsonld'
import { getProvider } from '@/lib/llm'
import type { LlmProvider, RecipeDraft } from '@/lib/llm/types'

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
  const response = await fetch(url, {
    headers: {
      // Some sites serve a stub page to unknown clients.
      'User-Agent':
        'Mozilla/5.0 (compatible; mangia/1.0; +https://github.com/mangia)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.text()
}

export async function importFromUrl(
  url: string,
  deps: ImportDeps = {},
): Promise<ImportResult> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Not a valid URL: ${url}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Only http and https URLs can be imported: ${url}`)
  }

  const fetchHtml = deps.fetchHtml ?? defaultFetchHtml

  let html: string
  try {
    html = await fetchHtml(url)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not fetch ${url}: ${detail}`)
  }

  const structured = extractJsonLdRecipe(html)
  if (structured) {
    return { draft: structured, method: 'jsonld', sourceUrl: url }
  }

  const provider = deps.provider ?? getProvider()
  const text = htmlToText(html).slice(0, MAX_TEXT_CHARS)
  const draft = await provider.extractRecipe(text)
  return { draft, method: 'llm', sourceUrl: url }
}
