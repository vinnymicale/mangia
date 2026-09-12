import { parseIngredientLine } from '@/lib/parsing/parseIngredient'
import { QUANTITY_PATTERN } from '@/lib/parsing/fractions'
import type { ParsedIngredient } from '@/lib/parsing/types'
import type { RecipeDraft } from '@/lib/llm/types'

/**
 * A draft built from OCR text. It carries `notes` on top of `RecipeDraft`
 * because nothing read off a card is ever thrown away: whatever the structurer
 * could not place lands there for the user to sort out on the form.
 */
export interface OcrDraft extends Omit<RecipeDraft, 'ingredients'> {
  notes: string | null
  /**
   * Fuller than a `RecipeDraft` ingredient: these carry `rawText` and a
   * `confidence` the form uses to flag rows, which is exactly what OCR output
   * needs and what the model path gets for free by going through the parser.
   */
  ingredients: ParsedIngredient[]
}

const INGREDIENT_HEADING = /^\s*(ingredients?|you will need)\s*:?\s*$/i
const METHOD_HEADING = /^\s*(method|directions?|instructions?|steps?|preparation)\s*:?\s*$/i
const SERVINGS = /\b(?:serves|servings?|makes|yields?)\b[^\d]{0,6}(\d+)/i
const PREP = /\bprep(?:aration)?\b[^\d]{0,12}(\d+)\s*(hours?|hrs?|minutes?|mins?)/i
const COOK = /\b(?:cook|bake|bakes?|cooking)\b[^\d]{0,12}(\d+)\s*(hours?|hrs?|minutes?|mins?)/i

/**
 * An ingredient line is short and starts with a quantity, or is short and
 * mentions an amount at all. Prose on a recipe card is longer than this.
 */
const INGREDIENT_MAX_CHARS = 48

/** Longer than this is a sentence someone wrote on the card, not a title. */
const TITLE_MAX_CHARS = 60

function toMinutes(value: string, unit: string): number {
  return /^h/i.test(unit) ? Number(value) * 60 : Number(value)
}

function looksLikeIngredient(line: string): boolean {
  if (line.length > INGREDIENT_MAX_CHARS) return false
  return QUANTITY_PATTERN.test(line)
}

/** Drops lines OCR produced out of rules, smudges, and card edges. */
function hasLetters(line: string): boolean {
  return /[a-z]/i.test(line)
}

function lowConfidence(line: string): ParsedIngredient {
  // Everything off a photo is flagged regardless of how cleanly it parsed:
  // a confident parse of a misread line is the failure mode that matters.
  return { ...parseIngredientLine(line), confidence: 'low' }
}

/**
 * Builds a recipe draft from raw OCR text, with no model call.
 *
 * Two strategies, in order. When the card has `Ingredients` / `Method`
 * headings, they are authoritative. When it does not -- most handwritten cards
 * do not -- the shape stands in: a run of short quantity-led lines is the
 * ingredient list, and the prose after it is the method.
 */
export function structureOcrText(text: string): OcrDraft {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && hasLetters(line))

  const empty: OcrDraft = {
    title: '',
    description: null,
    instructions: '',
    notes: null,
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    ingredients: [],
    tags: [],
  }
  if (lines.length === 0) return empty

  // The title is the first line, unless it reads as an ingredient -- a card
  // that opens with "2 cups flour" has no title to take -- or unless it is
  // the only line, in which case it is an annotation with no recipe under it
  // and belongs in notes rather than being promoted to a name.
  const isTitle =
    lines.length > 1 &&
    !looksLikeIngredient(lines[0]) &&
    lines[0].length <= TITLE_MAX_CHARS
  const titleLine = isTitle ? lines[0] : null
  const body = titleLine === null ? lines : lines.slice(1)

  const draft: OcrDraft = { ...empty, title: titleLine ?? '' }

  const ingredientLines: string[] = []
  const instructionLines: string[] = []
  const noteLines: string[] = []

  const ingredientHeading = body.findIndex((l) => INGREDIENT_HEADING.test(l))
  const methodHeading = body.findIndex((l) => METHOD_HEADING.test(l))
  const headed = ingredientHeading !== -1 || methodHeading !== -1

  body.forEach((line, index) => {
    if (INGREDIENT_HEADING.test(line) || METHOD_HEADING.test(line)) return

    // Metadata is consumed wherever it appears; a card may put "Serves 6"
    // under the title or at the very bottom.
    const servingsMatch = line.match(SERVINGS)
    const prepMatch = line.match(PREP)
    const cookMatch = line.match(COOK)
    if (servingsMatch || prepMatch || cookMatch) {
      if (servingsMatch) draft.servings ??= Number(servingsMatch[1])
      if (prepMatch) draft.prepMinutes ??= toMinutes(prepMatch[1], prepMatch[2])
      if (cookMatch) draft.cookMinutes ??= toMinutes(cookMatch[1], cookMatch[2])
      return
    }

    if (headed) {
      const inIngredients =
        ingredientHeading !== -1 &&
        index > ingredientHeading &&
        (methodHeading === -1 || index < methodHeading)
      const inMethod = methodHeading !== -1 && index > methodHeading
      if (inIngredients) ingredientLines.push(line)
      else if (inMethod) instructionLines.push(line)
      else noteLines.push(line)
      return
    }

    // Headingless: once prose has started, the ingredient list is over. A
    // short line late in a method ("Serve hot.") is a step, not an ingredient.
    if (instructionLines.length === 0 && looksLikeIngredient(line)) {
      ingredientLines.push(line)
    } else if (ingredientLines.length > 0 || !looksLikeIngredient(line)) {
      instructionLines.push(line)
    } else {
      noteLines.push(line)
    }
  })

  // Prose with no ingredient list in front of it is not a method -- it is a
  // scrap off the card ("from Aunt Ida, 1974"). Calling it a method would
  // dress up a failed parse as a successful one.
  if (ingredientLines.length === 0 && instructionLines.length > 0 && !headed) {
    noteLines.unshift(...instructionLines.splice(0))
  }

  draft.ingredients = ingredientLines.map(lowConfidence)
  draft.instructions = instructionLines
    .map((line, index) => `${index + 1}. ${line.replace(/^\s*\d+[.)]\s*/, '')}`)
    .join('\n')
  draft.notes = noteLines.length > 0 ? noteLines.join('\n') : null

  return draft
}
