import { GoogleGenAI } from '@google/genai'
import type { ParsedIngredient } from '@/lib/parsing/types'
import {
  RecipeDraftSchema,
  DraftIngredientSchema,
  EXTRACT_RECIPE_PROMPT,
  PARSE_LINES_PROMPT,
  type LlmProvider,
  type RecipeDraft,
} from './types'
import { z } from 'zod'

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
}
