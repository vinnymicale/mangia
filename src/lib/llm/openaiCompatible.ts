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
