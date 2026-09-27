import { GoogleGenAI } from '@google/genai'
import type { ParsedIngredient } from '@/lib/parsing/types'
import {
  RecipeDraftSchema,
  DraftIngredientSchema,
  EXTRACT_RECIPE_PROMPT,
  EXTRACT_RECIPE_FROM_IMAGE_PROMPT,
  EXTRACT_RECIPE_FROM_VIDEO_PROMPT,
  PARSE_LINES_PROMPT,
  type LlmProvider,
  type RecipeDraft,
  type VideoSource,
} from './types'
import { z } from 'zod'
import {
  ESTIMATE_NUTRITION_PROMPT,
  ESTIMATE_UNIT_WEIGHTS_PROMPT,
  MATCH_FOODS_PROMPT,
  matchFoodsMessage,
  parseMatchFoods,
  parseNutrition,
  parseUnitWeights,
  unitWeightsMessage,
  type FoodMatchItem,
  type UnitWeightItem,
} from './nutrition'
import type { Nutrients } from '@/lib/nutrition/types'

/** Strips the json code fences some models wrap JSON in. */
function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
}

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini'
  private client: GoogleGenAI
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenAI({ apiKey })
    this.model = model
  }

  private async generate(system: string, user: string): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: `${system}\n\n---\n\n${user}`,
      config: { responseMimeType: 'application/json' },
    })
    return response.text ?? ''
  }

  async extractRecipe(text: string): Promise<RecipeDraft> {
    const raw = await this.generate(EXTRACT_RECIPE_PROMPT, text)
    return RecipeDraftSchema.parse(JSON.parse(stripFences(raw)))
  }

  async extractRecipeFromImage(image: Buffer, mimeType: string): Promise<RecipeDraft> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: {
        parts: [
          { text: EXTRACT_RECIPE_FROM_IMAGE_PROMPT },
          { inlineData: { mimeType, data: image.toString('base64') } },
        ],
      },
      config: { responseMimeType: 'application/json' },
    })
    return RecipeDraftSchema.parse(JSON.parse(stripFences(response.text ?? '')))
  }

  /**
   * Reads a recipe out of a video.
   *
   * A YouTube URL goes over as a `fileData` part, which Gemini fetches and
   * decodes itself -- no download, no upload, no bytes through this server.
   * Everything else arrives as bytes and goes inline.
   */
  async extractRecipeFromVideo(source: VideoSource): Promise<RecipeDraft> {
    const media =
      source.kind === 'url'
        ? { fileData: { fileUri: source.url, mimeType: 'video/*' } }
        : { inlineData: { mimeType: source.mimeType, data: source.data.toString('base64') } }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: {
        parts: [{ text: EXTRACT_RECIPE_FROM_VIDEO_PROMPT }, media],
      },
      config: { responseMimeType: 'application/json' },
    })
    return RecipeDraftSchema.parse(JSON.parse(stripFences(response.text ?? '')))
  }

  async parseIngredientLines(lines: string[]): Promise<ParsedIngredient[]> {
    const raw = await this.generate(PARSE_LINES_PROMPT, lines.join('\n'))
    const parsed = z
      .array(DraftIngredientSchema)
      .parse(JSON.parse(stripFences(raw)))
    return parsed.map((p, i) => ({
      quantity: p.quantity,
      unit: p.unit,
      ingredient: p.ingredient,
      note: p.note,
      rawText: lines[i] ?? p.ingredient,
      confidence: 'high' as const,
    }))
  }

  async matchFoods(items: FoodMatchItem[]): Promise<(number | null)[]> {
    if (items.length === 0) return []
    const raw = await this.generate(MATCH_FOODS_PROMPT, matchFoodsMessage(items))
    return parseMatchFoods(raw, items)
  }

  async estimateUnitWeights(items: UnitWeightItem[]): Promise<(number | null)[]> {
    if (items.length === 0) return []
    const raw = await this.generate(ESTIMATE_UNIT_WEIGHTS_PROMPT, unitWeightsMessage(items))
    return parseUnitWeights(raw, items)
  }

  async estimateNutrition(name: string): Promise<Nutrients> {
    return parseNutrition(await this.generate(ESTIMATE_NUTRITION_PROMPT, name))
  }
}
