import priceSystemPrompt from '../prompts/price-system-prompt.js'
import type { AiProviderType, CrossProviderFallback } from '../types/ai-types.js'

type Env = Record<string, string | undefined>

const getEnv = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Env } }).process?.env
  return env?.[key]
}

// Model keys - OpenRouter provides alternative routes to same models
export type AiModelKey =
  | 'sonnet'
  | 'grok'
  | 'groq'
  // OpenRouter alternative routes
  | 'openrouter-sonnet'  // Claude Sonnet 4.5 via OpenRouter
  | 'openrouter-opus'    // Claude Opus 4.5 via OpenRouter
  | 'openrouter-llama'   // Llama 3.3 70B via OpenRouter
  | 'openrouter-grok'    // Grok 4.1 via OpenRouter

export type AiProvider = 'openai-compatible'

export interface AiModelConfig {
  id: string
  displayName: string
  provider: AiProvider
  providerType: AiProviderType
  apiKeyEnv: string
  baseUrl?: string
  temperature: number
  maxTokens: number
  timeoutMs: number
  costPer1kInputUsd: number
  costPer1kOutputUsd: number
  contextWindow?: number
  supportsStreaming?: boolean
  supportsVision?: boolean
}

export interface AiRoutingConfig {
  defaultModel: AiModelKey
  taskModelMap: Record<string, AiModelKey>
  fallbackMap: Record<AiModelKey, AiModelKey>
  crossProviderFallbacks: CrossProviderFallback[]
}

export interface AiProviderSettings {
  primary: AiProviderType
  enableFallback: boolean
  openRouter: {
    baseUrl: string
    appUrl: string
    appName: string
  }
  vercelGateway: {
    baseUrl: string
  }
}

export interface AiConversationConfig {
  maxHistoryMessages: number
}

export interface AiPerformanceConfig {
  slowResponseMs: number
}

export interface AiConfig {
  models: Record<AiModelKey, AiModelConfig>
  routing: AiRoutingConfig
  providers: AiProviderSettings
  conversation: AiConversationConfig
  performance: AiPerformanceConfig
  systemPrompt?: string
}

// Provider base URLs
const vercelGatewayBaseUrl =
  getEnv('VERCEL_AI_GATEWAY_BASE_URL') ?? 'https://ai-gateway.vercel.sh/v1/chat/completions'

const openRouterBaseUrl = 'https://openrouter.ai/api/v1'

// Model aliases for backward compatibility
const modelAliases: Record<string, AiModelKey> = {
  // Vercel Gateway models
  sonnet: 'sonnet',
  'claude-sonnet': 'sonnet',
  'sonnet-4.5': 'sonnet',
  opus: 'sonnet',
  grok: 'grok',
  'grok-4.1': 'grok',
  general: 'grok',
  groq: 'groq',
  'llama-3.3-70b': 'groq',
  haiku: 'groq',
  tech: 'groq',
  // OpenRouter alternative routes
  'openrouter-sonnet': 'openrouter-sonnet',
  'openrouter-claude': 'openrouter-sonnet',
  'openrouter-opus': 'openrouter-opus',
  'openrouter-llama': 'openrouter-llama',
  'llama-70b': 'openrouter-llama',
  'openrouter-grok': 'openrouter-grok',
  'grok-openrouter': 'openrouter-grok'
}

export const resolveModelKey = (value?: string): AiModelKey | undefined => {
  if (!value) return undefined
  return modelAliases[value.toLowerCase()]
}

// Determine primary provider from env
const getPrimaryProvider = (): AiProviderType => {
  const envValue = getEnv('AI_PRIMARY_PROVIDER')
  if (envValue === 'vercel-gateway') return 'vercel-gateway'
  if (envValue === 'openrouter') return 'openrouter'
  // Default to openrouter if API key is present
  return getEnv('OPENROUTER_API_KEY') ? 'openrouter' : 'vercel-gateway'
}

const enableProviderFallback = getEnv('AI_ENABLE_PROVIDER_FALLBACK') !== 'false'

// Default to openrouter-llama since Vercel AI Gateway is not working
// OpenRouter is available and configured
const defaultModel = resolveModelKey(getEnv('AI_DEFAULT_MODEL')) ?? 'openrouter-llama'

export const defaultAiConfig: AiConfig = {
  models: {
    // Vercel Gateway models (existing)
    sonnet: {
      id: 'anthropic/claude-sonnet-4.5',
      displayName: 'Claude Sonnet 4.5',
      provider: 'openai-compatible',
      providerType: 'vercel-gateway',
      apiKeyEnv: 'VERCEL_AI_GATEWAY_API_KEY',
      baseUrl: vercelGatewayBaseUrl,
      temperature: 0.4,
      maxTokens: 4096,
      timeoutMs: 45_000,
      costPer1kInputUsd: 0.003,
      costPer1kOutputUsd: 0.015,
      contextWindow: 200_000,
      supportsStreaming: true,
      supportsVision: true
    },
    grok: {
      id: 'xai/grok-4.1',
      displayName: 'Grok 4.1 Reasoning',
      provider: 'openai-compatible',
      providerType: 'vercel-gateway',
      apiKeyEnv: 'VERCEL_AI_GATEWAY_API_KEY',
      baseUrl: vercelGatewayBaseUrl,
      temperature: 0.4,
      maxTokens: 2048,
      timeoutMs: 30_000,
      costPer1kInputUsd: 0.003,
      costPer1kOutputUsd: 0.015,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false
    },
    groq: {
      id: getEnv('GROQ_TECHNICAL_MODEL') ?? 'groq/llama-3.3-70b-versatile',
      displayName: 'Groq Llama 3.3 70B',
      provider: 'openai-compatible',
      providerType: 'vercel-gateway',
      apiKeyEnv: 'VERCEL_AI_GATEWAY_API_KEY',
      baseUrl: vercelGatewayBaseUrl,
      temperature: 0.25,
      maxTokens: 2048,
      timeoutMs: 20_000,
      costPer1kInputUsd: 0.00059,
      costPer1kOutputUsd: 0.00079,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false
    },

    // OpenRouter alternative routes (same models, different provider)
    'openrouter-sonnet': {
      id: 'anthropic/claude-sonnet-4',
      displayName: 'Claude Sonnet 4.5 (OpenRouter)',
      provider: 'openai-compatible',
      providerType: 'openrouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: openRouterBaseUrl,
      temperature: 0.4,
      maxTokens: 4096,
      timeoutMs: 60_000,
      // OpenRouter pricing for Claude Sonnet
      costPer1kInputUsd: 0.003,
      costPer1kOutputUsd: 0.015,
      contextWindow: 200_000,
      supportsStreaming: true,
      supportsVision: true
    },
    'openrouter-llama': {
      id: 'meta-llama/llama-3.3-70b-instruct',
      displayName: 'Llama 3.3 70B (OpenRouter)',
      provider: 'openai-compatible',
      providerType: 'openrouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: openRouterBaseUrl,
      temperature: 0.25,
      maxTokens: 2048,
      timeoutMs: 30_000,
      costPer1kInputUsd: 0.00012,
      costPer1kOutputUsd: 0.0003,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false
    },
    'openrouter-grok': {
      id: 'x-ai/grok-4',
      displayName: 'Grok 4.1 (OpenRouter)',
      provider: 'openai-compatible',
      providerType: 'openrouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: openRouterBaseUrl,
      temperature: 0.3,
      maxTokens: 4096,
      timeoutMs: 45_000,
      costPer1kInputUsd: 0.003,
      costPer1kOutputUsd: 0.015,
      contextWindow: 128_000,
      supportsStreaming: true,
      supportsVision: false
    },
    'openrouter-opus': {
      id: 'anthropic/claude-opus-4',
      displayName: 'Claude Opus 4.5 (OpenRouter)',
      provider: 'openai-compatible',
      providerType: 'openrouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: openRouterBaseUrl,
      temperature: 0.4,
      maxTokens: 8192,
      timeoutMs: 90_000,
      costPer1kInputUsd: 0.015,
      costPer1kOutputUsd: 0.075,
      contextWindow: 200_000,
      supportsStreaming: true,
      supportsVision: true
    }
  },

  routing: {
    defaultModel,
    taskModelMap: {
      // All models via OpenRouter
      // Fast technical analysis
      analysis: 'openrouter-llama',
      // Deep research - Claude Opus 4.5
      research: 'openrouter-opus',
      // Complex reasoning - Claude Opus 4.5
      reasoning: 'openrouter-opus',
      // Ultra-fast technical - Llama
      technical: 'openrouter-llama',
      'quick-pulse': 'openrouter-llama',
      quickpulse: 'openrouter-llama',
      // Real-time news via Grok 4.1
      news: 'openrouter-grok',
      // Sentiment analysis via Grok 4.1
      sentiment: 'openrouter-grok',
      // General chat via Llama
      chat: 'openrouter-llama',
      general: 'openrouter-llama'
    },
    // OpenRouter-only fallback chain
    fallbackMap: {
      sonnet: 'openrouter-sonnet',
      grok: 'openrouter-grok',
      groq: 'openrouter-llama',
      'openrouter-sonnet': 'openrouter-llama',
      'openrouter-llama': 'openrouter-grok',
      'openrouter-grok': 'openrouter-opus',
      'openrouter-opus': 'openrouter-sonnet'
    },
    // Cross-provider fallbacks (all within OpenRouter now)
    crossProviderFallbacks: []
  },

  providers: {
    primary: getPrimaryProvider(),
    enableFallback: enableProviderFallback,
    openRouter: {
      baseUrl: openRouterBaseUrl,
      appUrl: getEnv('OPENROUTER_APP_URL') ?? 'https://pulse-solvys.vercel.app',
      appName: getEnv('OPENROUTER_APP_NAME') ?? 'Pulse-AI-Gateway'
    },
    vercelGateway: {
      baseUrl: vercelGatewayBaseUrl
    }
  },

  conversation: {
    maxHistoryMessages: Number.parseInt(getEnv('AI_MAX_HISTORY_MESSAGES') ?? '24', 10)
  },

  performance: {
    slowResponseMs: Number.parseInt(getEnv('AI_SLOW_RESPONSE_MS') ?? '3000', 10)
  },

  systemPrompt: priceSystemPrompt
}

// Helper to check if a model uses OpenRouter
export const isOpenRouterModel = (modelKey: AiModelKey): boolean => {
  return modelKey.startsWith('openrouter-')
}

// Helper to get equivalent model across providers
export const getCrossProviderEquivalent = (
  modelKey: AiModelKey,
  config: AiConfig = defaultAiConfig
): { model: AiModelKey; provider: AiProviderType } | null => {
  const fallback = config.routing.crossProviderFallbacks.find((f) => f.from === modelKey)
  if (fallback) {
    return { model: fallback.to as AiModelKey, provider: fallback.provider }
  }
  return null
}

// Get all models for a specific provider
export const getModelsByProvider = (
  providerType: AiProviderType,
  config: AiConfig = defaultAiConfig
): AiModelKey[] => {
  return (Object.keys(config.models) as AiModelKey[]).filter(
    (key) => config.models[key].providerType === providerType
  )
}
