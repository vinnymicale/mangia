import { resolveConfig } from '@/lib/config'
import { buildProvider, type LlmProvider } from '@/lib/llm'
import type { UsdaOptions } from './usda'

/**
 * What a nutrition route needs from configuration, read fresh per request so a
 * key saved on the settings page works on the next one. The provider is null
 * when no model is set up, which every caller handles by working without one.
 */
export async function nutritionServices(): Promise<{ usda: UsdaOptions; provider: LlmProvider | null }> {
  const config = await resolveConfig()
  let provider: LlmProvider | null = null
  if (config.llm.apiKey) {
    try {
      provider = buildProvider(config.llm)
    } catch {
      // Incomplete configuration (an OpenAI-compatible provider with no base
      // URL) is the same as none here: the estimate works without a model.
    }
  }
  return { usda: config.usda, provider }
}
