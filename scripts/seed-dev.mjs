// Seeds a development database with the recipes from the design mockup
// (docs/superpowers/specs/mangia-design-reference.html) so the UI can be
// checked against realistic content instead of e2e fixture noise.
//
// Written against better-sqlite3 rather than the Prisma client for the same
// reason as the sibling scripts: it needs no generated client and can run
// before `prisma generate`. Destructive by design — it clears recipe, list,
// and staple data first, so it is guarded against non-dev databases below.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { STAPLES, RECIPES } from './seed-data.mjs'

const url = process.env.DATABASE_URL ?? 'file:./dev.db'
const path = url.replace(/^file:/, '')

// A misdirected DATABASE_URL would wipe real recipes, and this script has no
// way to put them back. Opting in explicitly is cheaper than that mistake.
if (!/dev\.db$|seed\.db$/.test(path) && process.env.SEED_FORCE !== '1') {
  console.error(
    `Refusing to seed ${path}: this deletes all recipes, lists, and staples.\n` +
      'Set SEED_FORCE=1 if that is genuinely what you want.',
  )
  process.exit(1)
}

const db = new Database(path)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// The FTS triggers must exist before the inserts, or the search index will be
// missing every row this script writes.
db.exec(readFileSync('./prisma/migrations/manual/fts.sql', 'utf8'))

const id = () => randomUUID()
const now = () => new Date().toISOString()

/* ── Write ───────────────────────────────────────────────────────────── */

const insertIngredient = db.prepare(
  'INSERT INTO Ingredient (id, name, category) VALUES (?, ?, ?)',
)
const findIngredient = db.prepare('SELECT id FROM Ingredient WHERE name = ?')

/** Ingredient names are stored normalized, matching normalizeIngredientName. */
function ingredientId(name, category) {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ')
  const existing = findIngredient.get(normalized)
  if (existing) return existing.id
  const created = id()
  insertIngredient.run(created, normalized, category ?? null)
  return created
}

const seed = db.transaction(() => {
  // Order matters only where cascades do not cover it; Ingredient is last
  // because everything else references it.
  db.exec(`
    DELETE FROM ShoppingItemSource;
    DELETE FROM ShoppingListItem;
    DELETE FROM ShoppingList;
    DELETE FROM PantryStaple;
    DELETE FROM RecipeTag;
    DELETE FROM RecipeIngredient;
    DELETE FROM Recipe;
    DELETE FROM Tag;
    DELETE FROM IngredientAlias;
    DELETE FROM Ingredient;
  `)

  for (const [name, category] of STAPLES) {
    const ingredient = ingredientId(name, category)
    db.prepare(
      'INSERT INTO PantryStaple (id, name, ingredientId) VALUES (?, ?, ?)',
    ).run(id(), name, ingredient)
  }

  const tagIds = new Map()
  function tagId(name) {
    if (!tagIds.has(name)) {
      const created = id()
      db.prepare('INSERT INTO Tag (id, name, kind) VALUES (?, ?, ?)').run(
        created,
        name,
        'freeform',
      )
      tagIds.set(name, created)
    }
    return tagIds.get(name)
  }

  const recipeIds = new Map()

  // Reversed so the first recipe listed here ends up newest, and the browse
  // page's default "recently added" sort shows them in the mockup's order.
  const ordered = [...RECIPES].reverse()

  ordered.forEach((recipe, index) => {
    const recipeId = id()
    recipeIds.set(recipe.title, recipeId)

    // Spread createdAt across recent days so the sort is stable and the dates
    // look like a library built over time rather than one bulk import.
    const created = new Date(Date.now() - (ordered.length - index) * 86400000)

    db.prepare(
      `INSERT INTO Recipe
         (id, title, description, sourceUrl, prepMinutes, cookMinutes,
          servings, instructions, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      recipeId,
      recipe.title,
      recipe.description,
      recipe.sourceUrl ?? null,
      recipe.prepMinutes,
      recipe.cookMinutes,
      recipe.servings,
      recipe.steps.join('\n'),
      created.toISOString(),
      now(),
    )

    for (const tag of recipe.tags) {
      db.prepare(
        'INSERT INTO RecipeTag (recipeId, tagId) VALUES (?, ?)',
      ).run(recipeId, tagId(tag))
    }

    recipe.ingredients.forEach(([quantity, unit, name, note, category], i) => {
      // rawText is what the parser would have seen; the detail view renders the
      // structured columns, but import and shopping-list code reads this back.
      const rawText = [quantity, unit, name, note && `(${note})`]
        .filter((part) => part !== null && part !== undefined && part !== '')
        .join(' ')

      db.prepare(
        `INSERT INTO RecipeIngredient
           (id, recipeId, ingredientId, quantity, unit, note, rawText, sortOrder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id(),
        recipeId,
        ingredientId(name, category),
        quantity,
        unit,
        note,
        rawText,
        i,
      )
    })
  })

  // One list, from the two recipes the mockup's Lists screen draws from, so
  // the merge and multi-source attribution paths have something to render.
  const listId = id()
  db.prepare(
    'INSERT INTO ShoppingList (id, name, createdAt) VALUES (?, ?, ?)',
  ).run(listId, "This week's shop", now())

  const sourceTitles = ['Spaghetti alle Vongole', 'Cacio e Pepe']
  const sourceIds = sourceTitles.map((title) => recipeIds.get(title))

  const rows = db
    .prepare(
      `SELECT ri.ingredientId, ri.recipeId, ri.quantity, ri.unit, i.name
         FROM RecipeIngredient ri
         JOIN Ingredient i ON i.id = ri.ingredientId
         LEFT JOIN PantryStaple s ON s.ingredientId = ri.ingredientId
        WHERE ri.recipeId IN (${sourceIds.map(() => '?').join(',')})
          AND s.id IS NULL
        ORDER BY ri.sortOrder`,
    )
    .all(...sourceIds)

  // Same-unit rows merge and carry both recipes as sources -- spaghetti
  // appears in both recipes, which is the case the list view exists to show.
  const merged = new Map()
  for (const row of rows) {
    const key = `${row.ingredientId}|${row.unit ?? ''}`
    const bucket = merged.get(key)
    if (bucket) {
      if (row.quantity !== null) bucket.quantity = (bucket.quantity ?? 0) + row.quantity
      if (!bucket.recipeIds.includes(row.recipeId)) bucket.recipeIds.push(row.recipeId)
    } else {
      merged.set(key, {
        ingredientId: row.ingredientId,
        quantity: row.quantity,
        unit: row.unit,
        recipeIds: [row.recipeId],
      })
    }
  }

  ;[...merged.values()].forEach((item, index) => {
    const itemId = id()
    db.prepare(
      `INSERT INTO ShoppingListItem
         (id, listId, ingredientId, quantity, unit, checked, sortOrder)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
    ).run(itemId, listId, item.ingredientId, item.quantity, item.unit, index)

    for (const recipeId of item.recipeIds) {
      db.prepare(
        'INSERT INTO ShoppingItemSource (shoppingListItemId, recipeId) VALUES (?, ?)',
      ).run(itemId, recipeId)
    }
  })

  return merged.size
})

const itemCount = seed()

db.close()
console.log(
  `Seeded ${path}: ${RECIPES.length} recipes, ${STAPLES.length} staples, ` +
    `1 shopping list (${itemCount} items).`,
)
