import { describe, it, expect, vi } from 'vitest'
import { importFromUrl, htmlToText, isPrivateAddress } from './webImporter'
import type { LlmProvider, RecipeDraft } from '@/lib/llm/types'

const JSONLD_PAGE = `<html><head><script type="application/ld+json">${JSON.stringify(
  {
    '@type': 'Recipe',
    name: 'Structured Stew',
    recipeIngredient: ['1 lb beef'],
    recipeInstructions: 'Stew it.',
  },
)}</script></head><body>ignored</body></html>`

const PLAIN_PAGE = `<html><head><style>.x{color:red}</style></head>
  <body><script>var a=1</script><h1>Grandma Cookies</h1>
  <p>2 cups flour</p><p>Bake at 350.</p></body></html>`

function fakeProvider(draft: RecipeDraft): LlmProvider {
  return {
    name: 'fake',
    extractRecipe: vi.fn(async () => draft),
    parseIngredientLines: vi.fn(async () => []),
  }
}

const LLM_DRAFT: RecipeDraft = {
  title: 'Grandma Cookies',
  description: null,
  instructions: '1. Bake at 350.',
  servings: null,
  prepMinutes: null,
  cookMinutes: null,
  ingredients: [
    { quantity: 2, unit: 'cup', ingredient: 'flour', note: null },
  ],
  tags: [],
}

describe('htmlToText', () => {
  it('drops script and style content', () => {
    const text = htmlToText(PLAIN_PAGE)
    expect(text).not.toContain('var a=1')
    expect(text).not.toContain('color:red')
    expect(text).toContain('Grandma Cookies')
  })

  it('collapses runs of whitespace', () => {
    expect(htmlToText('<p>a</p>\n\n\n<p>b</p>')).toBe('a\nb')
  })
})

describe('importFromUrl', () => {
  it('uses json-ld when the page provides it and never calls the llm', async () => {
    const provider = fakeProvider(LLM_DRAFT)
    const result = await importFromUrl('https://example.com/stew', {
      fetchHtml: async () => JSONLD_PAGE,
      provider,
    })
    expect(result.method).toBe('jsonld')
    expect(result.draft.title).toBe('Structured Stew')
    expect(provider.extractRecipe).not.toHaveBeenCalled()
  })

  it('records the source url', async () => {
    const result = await importFromUrl('https://example.com/stew', {
      fetchHtml: async () => JSONLD_PAGE,
      provider: fakeProvider(LLM_DRAFT),
    })
    expect(result.sourceUrl).toBe('https://example.com/stew')
  })

  it('falls back to the llm when there is no json-ld', async () => {
    const provider = fakeProvider(LLM_DRAFT)
    const result = await importFromUrl('https://example.com/cookies', {
      fetchHtml: async () => PLAIN_PAGE,
      provider,
    })
    expect(result.method).toBe('llm')
    expect(result.draft.title).toBe('Grandma Cookies')
    expect(provider.extractRecipe).toHaveBeenCalledOnce()
  })

  it('rejects a non-http url', async () => {
    await expect(
      importFromUrl('file:///etc/passwd', {
        fetchHtml: async () => '',
        provider: fakeProvider(LLM_DRAFT),
      }),
    ).rejects.toThrow(/http/i)
  })

  it('surfaces a fetch failure with the url', async () => {
    await expect(
      importFromUrl('https://example.com/gone', {
        fetchHtml: async () => {
          throw new Error('404')
        },
        provider: fakeProvider(LLM_DRAFT),
      }),
    ).rejects.toThrow(/example.com\/gone/)
  })
})

describe('isPrivateAddress', () => {
  it('flags loopback, LAN, and metadata addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.5',
      '192.168.1.1',
      '172.16.0.1',
      '172.31.255.255',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
  })

  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '192.169.0.1', '2606:4700::1']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })
})

describe('importFromUrl SSRF guard', () => {
  it('refuses to fetch a private address with the real fetcher', async () => {
    await expect(importFromUrl('http://127.0.0.1:8080/admin')).rejects.toThrow(
      /private address/,
    )
  })

  it('refuses the cloud metadata endpoint', async () => {
    await expect(
      importFromUrl('http://169.254.169.254/latest/meta-data/'),
    ).rejects.toThrow(/private address/)
  })
})
