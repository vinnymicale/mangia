export type Confidence = 'high' | 'low'

export interface ParsedIngredient {
  quantity: number | null
  unit: string | null
  ingredient: string
  note: string | null
  rawText: string
  confidence: Confidence
}

export function isLowConfidence(p: ParsedIngredient): boolean {
  return p.confidence === 'low' || p.ingredient.trim() === ''
}
