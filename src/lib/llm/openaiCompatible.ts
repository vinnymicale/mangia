import type { ParsedIngredient } from '@/lib/parsing/types'
import {
  RecipeDraftSchema,
  DraftIngredientSchema,
  EXTRACT_RECIPE_PROMPT,
  EXTRACT_RECIPE_FROM_IMAGE_PROMPT,
  PARSE_LINES_PROMPT,
  type LlmProvider,
  type RecipeDraft,
} from './types'
import { z } from 'zod'

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
}

/** Works against OpenAI, Ollama, and LM Studio via a chat-completions endpoint. */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name = 'openai-compatible'

  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string,
  ) {}

  private async generate(system: string, user: string): Promise<string> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      }),
    })
    if (!response.ok) {
      throw new Error(
        `LLM request failed: ${response.status} ${await response.text()}`,
      )
    }
    const body = await response.json()
    return body.choices?.[0]?.message?.content ?? ''
  }

  async extractRecipe(text: string): Promise<RecipeDraft> {
    const raw = await this.generate(EXTRACT_RECIPE_PROMPT, text)
    return RecipeDraftSchema.parse(JSON.parse(stripFences(raw)))
  }

  /**
   * The `image_url` content part with a data URI is the shape OpenAI, Ollama
   * and LM Studio all accept, so one request body covers every backend the
   * settings page can point at.
   */
  async extractRecipeFromImage(image: Buffer, mimeType: string): Promise<RecipeDraft> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: EXTRACT_RECIPE_FROM_IMAGE_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribe this recipe.' },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${image.toString('base64')}` },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    })
    // A text-only model rejects this request. The photo import path treats that
    // as its signal to fall back to OCR rather than as a failure.
    if (!response.ok) {
      throw new Error(
        `LLM request failed: ${response.status} ${await response.text()}`,
      )
    }
    const body = await response.json()
    const raw = body.choices?.[0]?.message?.content ?? ''
    return RecipeDraftSchema.parse(JSON.parse(stripFences(raw)))
  }

  async parseIngredientLines(lines: string[]): Promise<ParsedIngredient[]> {
    const raw = await this.generate(PARSE_LINES_PROMPT, lines.join('\n'))
    const payload = JSON.parse(stripFences(raw))
    // A json_object response may wrap the array under a key.
    const array = Array.isArray(payload)
      ? payload
      : (payload.ingredients ?? payload.results ?? [])
    const parsed = z.array(DraftIngredientSchema).parse(array)
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
