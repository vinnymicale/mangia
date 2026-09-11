import { GeminiProvider } from './gemini'
import { OpenAiCompatibleProvider } from './openaiCompatible'
import { resolveConfig, type ResolvedConfig } from '@/lib/config'
import type { LlmProvider } from './types'

export * from './types'

/**
 * Builds a provider from already-resolved values. Throws when configuration is
 * incomplete.
 *
 * Split from `getProvider` so the settings page's connection test can build a
 * provider from a config it already has in hand without a second read.
 */
export function buildProvider(llm: ResolvedConfig['llm']): LlmProvider {
  if (!llm.apiKey) {
    throw new Error('No API key is set. Add one under Settings to use AI features.')
  }

  if (llm.provider === 'openai-compatible') {
    if (!llm.baseUrl) {
      throw new Error('A base URL is required for an OpenAI-compatible provider.')
    }
    return new OpenAiCompatibleProvider(llm.baseUrl, llm.apiKey, llm.model)
  }

  return new GeminiProvider(llm.apiKey, llm.model)
}

/**
 * Builds the configured provider, reading configuration fresh every time.
 *
 * The freshness is the point and not an oversight: both call sites invoke this
 * per request and hold nothing between them, which is what lets a key saved on
 * the settings page work on the very next request with no restart. Memoising
 * the provider here would quietly undo that.
 */
export async function getProvider(): Promise<LlmProvider> {
  const config = await resolveConfig()
  return buildProvider(config.llm)
}
