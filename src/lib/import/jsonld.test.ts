import { describe, it, expect } from 'vitest'
import { extractJsonLdRecipe } from './jsonld'

function page(jsonLd: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(
    jsonLd,
  )}</script></head><body></body></html>`
}

describe('extractJsonLdRecipe', () => {
  it('extracts a top-level Recipe object', () => {
    const draft = extractJsonLdRecipe(
      page({
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Pancakes',
        recipeYield: '4 servings',
        prepTime: 'PT10M',
        cookTime: 'PT15M',
        recipeIngredient: ['2 cups flour', '1 tsp salt'],
        recipeInstructions: 'Mix. Cook.',
      }),
    )
    expect(draft?.title).toBe('Pancakes')
    expect(draft?.servings).toBe(4)
    expect(draft?.prepMinutes).toBe(10)
    expect(draft?.cookMinutes).toBe(15)
    expect(draft?.ingredients).toHaveLength(2)
    expect(draft?.ingredients[0].ingredient).toBe('flour')
  })

  it('finds a Recipe inside an @graph array', () => {
    const draft = extractJsonLdRecipe(
      page({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Some Blog' },
          {
            '@type': 'Recipe',
            name: 'Graph Soup',
            recipeIngredient: ['1 onion'],
            recipeInstructions: 'Simmer.',
          },
        ],
      }),
    )
    expect(draft?.title).toBe('Graph Soup')
  })

  it('handles a @type array containing Recipe', () => {
    const draft = extractJsonLdRecipe(
      page({
        '@type': ['Recipe', 'NewsArticle'],
        name: 'Dual Typed',
        recipeIngredient: [],
        recipeInstructions: [],
      }),
    )
    expect(draft?.title).toBe('Dual Typed')
  })

  it('flattens HowToStep instruction objects into numbered lines', () => {
    const draft = extractJsonLdRecipe(
      page({
        '@type': 'Recipe',
        name: 'Stepped',
        recipeIngredient: [],
        recipeInstructions: [
          { '@type': 'HowToStep', text: 'Preheat the oven.' },
          { '@type': 'HowToStep', text: 'Bake for an hour.' },
        ],
      }),
    )
    expect(draft?.instructions).toBe('1. Preheat the oven.\n2. Bake for an hour.')
  })

  it('flattens HowToSection groups', () => {
    const draft = extractJsonLdRecipe(
      page({
        '@type': 'Recipe',
        name: 'Sectioned',
        recipeIngredient: [],
        recipeInstructions: [
          {
            '@type': 'HowToSection',
            itemListElement: [
              { '@type': 'HowToStep', text: 'Make the dough.' },
              { '@type': 'HowToStep', text: 'Rest it.' },
            ],
          },
        ],
      }),
    )
    expect(draft?.instructions).toBe('1. Make the dough.\n2. Rest it.')
  })

  it('parses ISO 8601 durations with hours', () => {
    const draft = extractJsonLdRecipe(
      page({
        '@type': 'Recipe',
        name: 'Slow',
        cookTime: 'PT2H30M',
        recipeIngredient: [],
        recipeInstructions: '',
      }),
    )
    expect(draft?.cookMinutes).toBe(150)
  })

  it('reads a numeric recipeYield', () => {
    const draft = extractJsonLdRecipe(
      page({
        '@type': 'Recipe',
        name: 'Numeric Yield',
        recipeYield: 6,
        recipeIngredient: [],
        recipeInstructions: '',
      }),
    )
    expect(draft?.servings).toBe(6)
  })

  it('returns null when the page has no Recipe', () => {
    expect(
      extractJsonLdRecipe(page({ '@type': 'WebPage', name: 'Nope' })),
    ).toBeNull()
  })

  it('returns null when the page has no json-ld at all', () => {
    expect(extractJsonLdRecipe('<html><body>hi</body></html>')).toBeNull()
  })

  it('ignores a malformed json-ld block and keeps scanning', () => {
    const html = `<html><head>
      <script type="application/ld+json">{not json</script>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name: 'Survivor',
        recipeIngredient: [],
        recipeInstructions: '',
      })}</script>
    </head></html>`
    expect(extractJsonLdRecipe(html)?.title).toBe('Survivor')
  })
})
