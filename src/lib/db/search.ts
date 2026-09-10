import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { db, ensureDbReady } from './client'
import { normalizeIngredientName } from './ingredients'

/**
 * Creates the FTS5 table and its sync triggers. Safe to call on every boot
 * and from tests; every statement uses IF NOT EXISTS.
 */
export async function ensureFtsSchema(): Promise<void> {
  const sql = readFileSync(
    join(process.cwd(), 'prisma', 'migrations', 'manual', 'fts.sql'),
    'utf8',
  )
  // better-sqlite3 executes one statement per call, and CREATE TRIGGER
  // bodies contain semicolons, so split only where a semicolon is followed by
  // a statement starting at column zero. Trigger-body statements are indented,
  // which is what keeps them attached to their enclosing CREATE TRIGGER.
  const statements = sql
    .split(/;\s*\n(?=(?:--[^\n]*\n)*(?:CREATE|INSERT|DROP))/i)
    .map((s) => s.trim().replace(/;$/, ''))
    .filter((s) => s !== '')
  for (const statement of statements) {
    await db.$executeRawUnsafe(statement)
  }
}

/**
 * Escapes a user query for FTS5 MATCH. Each word becomes a quoted prefix
 * term, which makes operators and quotes in user input inert.
 */
function toMatchQuery(query: string): string | null {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t !== '')
    .map((t) => `"${t}"*`)
  return terms.length > 0 ? terms.join(' ') : null
}

export async function searchRecipes(query: string): Promise<string[]> {
  const match = toMatchQuery(query)
  if (match === null) return []

  // The FTS5 table is not part of the Prisma schema, so a freshly pushed
  // database has no RecipeFts until this runs. Cached after the first call.
  await ensureDbReady()

  const rows = await db.$queryRawUnsafe<{ recipeId: string }[]>(
    `SELECT recipeId FROM RecipeFts3 WHERE RecipeFts3 MATCH ? ORDER BY rank`,
    match,
  )
  return rows.map((row) => row.recipeId)
}

export interface CoverageMatch {
  recipeId: string
  title: string
  haveCount: number
  totalCount: number
  coverage: number
  missing: string[]
}

/**
 * Ranks recipes by how much of their ingredient list the given names cover.
 * Partial matches are kept so the UI can show "missing 1 ingredient".
 */
export async function matchByIngredients(
  names: string[],
  opts: { minCoverage?: number } = {},
): Promise<CoverageMatch[]> {
  const have = new Set(names.map(normalizeIngredientName).filter((n) => n !== ''))
  if (have.size === 0) return []

  // Only recipes that use at least one of the given ingredients can score
  // above zero, so the scan is scoped to those rather than the whole table.
  const recipes = await db.recipe.findMany({
    where: { ingredients: { some: { ingredient: { name: { in: [...have] } } } } },
    include: { ingredients: { include: { ingredient: true } } },
  })

  const minCoverage = opts.minCoverage ?? 0
  const matches: CoverageMatch[] = []

  for (const recipe of recipes) {
    const totalCount = recipe.ingredients.length
    if (totalCount === 0) continue

    const missing: string[] = []
    let haveCount = 0
    for (const row of recipe.ingredients) {
      if (have.has(row.ingredient.name)) haveCount += 1
      else missing.push(row.ingredient.name)
    }

    const coverage = haveCount / totalCount
    if (haveCount === 0 || coverage < minCoverage) continue

    matches.push({
      recipeId: recipe.id,
      title: recipe.title,
      haveCount,
      totalCount,
      coverage,
      missing,
    })
  }

  matches.sort(
    (a, b) => b.coverage - a.coverage || a.missing.length - b.missing.length,
  )
  return matches
}
