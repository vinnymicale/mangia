# Mangia — Self-Hosted Recipe Manager

**Date:** 2026-09-07
**Status:** Approved design, ready for implementation planning

## Overview

Mangia is a self-hosted recipe manager for a single user. It stores recipes with
structured ingredients, searches them by text or by ingredients on hand, generates
merged shopping lists, and imports recipes from web URLs using an LLM.

The defining goal is **fast recipe entry**. Every other feature depends on recipes
actually getting into the system, so entry friction is the primary design constraint.

## Goals

- Enter a new recipe in under a minute, including its ingredients
- Import a recipe from a URL with one paste
- Find recipes by text or by "what can I cook with what I have?"
- Produce a merged shopping list from selected recipes
- Run as a single self-hosted container with a trivial backup story

## Non-Goals (v1)

Video import; meal planning calendar; nutrition data; serving-size scaling;
multi-user accounts; recipe sharing; mobile native apps.

Video import is explicitly deferred but the import layer is designed so it slots
in without UI changes.

## Decisions

| Area | Decision |
|---|---|
| Users | Single user, no authentication |
| Pantry | No tracked pantry or quantities; ad-hoc ingredient entry at search time. A small user-editable staples list is config, not inventory. |
| Ingredient parsing | Deterministic parser first, LLM fallback for low-confidence lines |
| LLM | Pluggable provider, Gemini by default |
| Video import | Deferred past v1 |
| Stack | Next.js + TypeScript |
| Database | SQLite (see rationale below) |

## Architecture

### Stack

Next.js 16 (App Router) + TypeScript, Prisma ORM, Tailwind CSS.
One Node process serves both UI and API routes.

The component set is small and purpose-built rather than pulled from
shadcn/ui: the interesting surfaces here — the ingredient review table, the
cooking view — are not generic form widgets, and the handful of buttons and
inputs around them do not justify the dependency.

### Database: SQLite

SQLite in WAL mode, not Postgres. For a single user with no auth, Postgres adds a
second container, ordered startup, connection configuration, and a `pg_dump`
backup process, in exchange for concurrency and network access this application
never uses. SQLite's backup is copying one file.

Prisma abstracts the driver, so migrating to Postgres later is a connection-string
and migration change rather than a rewrite.

### Deployment

Single Docker image, one compose service. A mounted volume at `/data` holds
`mangia.db` and uploaded images. Configuration via environment variables:

- `LLM_PROVIDER` (default `gemini`)
- `LLM_API_KEY`
- `LLM_MODEL`
- `LLM_BASE_URL` (for OpenAI-compatible endpoints, e.g. local Ollama)

### Module Boundaries

Four modules with defined interfaces, each testable in isolation:

**`lib/parsing/`** — Pure functions, no I/O, no network. Given an ingredient line,
returns `{quantity, unit, ingredient, note, confidence}`. Zero mocking required to
test; the highest-value test surface in the project.

**`lib/llm/`** — A `LlmProvider` interface:
```ts
interface LlmProvider {
  extractRecipe(text: string): Promise<RecipeDraft>
  parseIngredientLines(lines: string[]): Promise<ParsedIngredient[]>
}
```
Implementations: `GeminiProvider` (default), `OpenAiCompatibleProvider` (covers
OpenAI, Ollama, LM Studio via base URL). Mockable at the interface for all tests.

**`lib/import/`** — A `RecipeImporter` interface taking a URL and returning a
`RecipeDraft`. `WebImporter` is the v1 implementation. A future `VideoImporter`
implements the same interface; the UI is unaware of which ran.

**`lib/db/`** — Prisma client and query functions.

## Data Model

Ingredients are canonicalized and stored separately from their per-recipe usage.
This is what makes ingredient search, shopping-list merging, and autocomplete
possible; plain-text ingredient storage supports none of the three.

```
Recipe            id, title, description, sourceUrl, imagePath,
                  prepMinutes, cookMinutes, servings, instructions,
                  notes, lastCookedAt, createdAt, updatedAt

RecipeIngredient  id, recipeId, ingredientId,
                  quantity (nullable float), unit (nullable),
                  note, rawText, sortOrder, section (nullable)

Ingredient        id, name (unique, normalized), category
IngredientAlias   id, ingredientId, alias (unique, normalized)

Tag               id, name, kind (cuisine | course | diet | freeform)
RecipeTag         recipeId, tagId

ShoppingList      id, name, createdAt
ShoppingListItem  id, listId, ingredientId (nullable), quantity, unit,
                  checked, manualText
ShoppingItemSource  shoppingListItemId, recipeId

PantryStaple      id, ingredientId
```

**`rawText` is always preserved** on every `RecipeIngredient`. A bad parse never
destroys what the user typed, and recipes can render exactly as written.

**`section`** supports multi-part recipes ("For the sauce").

**Instructions are a single markdown field**, not a step table. Steps carry no
per-step queryable data, and one field makes editing substantially better.

**`IngredientAlias`** repairs ingredient fragmentation: "scallions" links to "green onion"
rather than creating a duplicate canonical ingredient.

**`PantryStaple`** is a user-editable configuration list of assumed-on-hand items
(salt, pepper, oil, water) so ingredient search isn't falsely blocked on them. It
holds no quantities and is not inventory — it is a static list of things always
treated as available.

## Recipe Entry

Three input paths converge on **one shared editable review table**. Import does not
get a separate UI.

### Door 1 — Paste-a-blob (primary)

A single textarea accepting freeform ingredient lines. On paste or blur, each line
runs through the deterministic parser and populates the review table with editable
quantity / unit / ingredient / note columns.

**Hybrid parsing:** the deterministic parser runs first — instant, free, offline,
and correct for the large majority of conventionally-formatted lines. Lines parsed
with low confidence are flagged. A "Clean up N lines with AI" button sends *only
the flagged lines* to the LLM. Normal typing never waits on a network round-trip,
and messy lines still get resolved.

The parser handles:
- Unicode and ASCII fractions (`½`, `1 1/2`)
- Ranges (`2-3`, `2 to 3`)
- Unit aliases (`tbsp` / `T` / `tablespoon`)
- Leading-note forms (`Zest of 1 lemon`)
- Trailing notes after a comma (`3 cloves garlic, minced`)
- Parenthetical amounts (`1 can (14 oz) tomatoes`)
- Unitless counts (`2 eggs`)

### Door 2 — Import from URL

Paste a link. The importer tries JSON-LD `schema.org/Recipe` extraction first —
free, instant, and published by most recipe sites — and falls back to running the
LLM over readable page text. The result populates the same review table, pre-filled,
retaining `sourceUrl`.

### Door 3 — Structured add

An "add row" control at the bottom of the review table with ingredient
autocomplete, for one-off additions and corrections.

### Confirm-on-save

Before saving, ingredient names not matching a canonical `Ingredient` are surfaced:
"garlic clove is new; did you mean garlic?" One click links it as an alias. This is
the mechanism that keeps the canonical vocabulary clean over time and keeps
ingredient search reliable long-term.

## Search and Browse

### Library

Card grid with images, plus a compact list view. Sort by recently added, recently
cooked, title, or total time. Filters (tag, cuisine, max total time) compose with
the active search query rather than replacing it.

### Text search

SQLite FTS5 over title, description, ingredients, and instructions.

### Cook-from-what-I-have

A chip input autocompleting against canonical ingredients. Results rank by
**coverage**: fully-makeable recipes first, then near-misses ordered by fewest
missing ingredients, each showing what's missing.

```
Chicken Piccata          have everything
Garlic Butter Pasta      missing 1: parsley
Weeknight Ragù           missing 2: pancetta, red wine
```

Near-misses are shown deliberately — "one ingredient away" is more useful than an
empty filtered result. Pantry staples are treated as on-hand.

## Shopping List

Select recipes, generate a list. Items merge across recipes by canonical ingredient,
summing only **compatible units** (2 cloves + 3 cloves = 5 cloves). Incompatible
units remain separate lines (1 cup + 200 g) rather than guessing a density
conversion.

Grouped by store category, matching the order a store is walked. Items are
checkable, freeform manual items can be added, and each line shows its source
recipes.

## Design Direction

Clean and food-forward. Images carry the visual weight; generous whitespace; one
accent color; system font stack with a strong type scale. Dark mode from day one.

**Cooking view** is mobile-first: large tappable checkboxes on ingredients and
steps, and a screen wake-lock toggle.

## Testing

| Surface | Approach |
|---|---|
| Ingredient parser | Broad unit-test table of real-world lines. Highest-value tests in the project. |
| Importers | Fixture-based against saved HTML, LLM mocked at the provider interface. |
| Shopping list merge | Unit tests on unit-compatibility and summing logic. |
| Ingredient matching | Unit tests on coverage ranking and alias resolution. |
| End-to-end | Playwright: add a recipe, import a URL, generate a shopping list. |
