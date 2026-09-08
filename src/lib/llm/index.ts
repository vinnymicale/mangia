import { GeminiProvider } from './gemini'
import { OpenAiCompatibleProvider } from './openaiCompatible'
import type { LlmProvider } from './types'

export * from './types'

/** Builds the configured provider. Throws when configuration is incomplete. */
export function getProvider(): LlmProvider {
  const kind = process.env.LLM_PROVIDER ?? 'gemini'
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) {
    throw new Error('LLM_API_KEY is not set. Configure it to use AI features.')
  }

  if (kind === 'openai-compatible') {
    const baseUrl = process.env.LLM_BASE_URL
    if (!baseUrl) {
      throw new Error(
        'LLM_BASE_URL is required when LLM_PROVIDER is openai-compatible.',
      )
    }
    return new OpenAiCompatibleProvider(
      baseUrl,
      apiKey,
      process.env.LLM_MODEL ?? 'gpt-4o-mini',
    )
  }

  if (kind === 'gemini') {
    return new GeminiProvider(apiKey, process.env.LLM_MODEL ?? 'gemini-2.5-flash')
  }

  throw new Error(`Unknown LLM_PROVIDER: ${kind}`)
}
