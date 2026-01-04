type Env = Record<string, string | undefined>

const getEnv = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Env } }).process?.env
  return env?.[key]
}

export type AiModelKey = 'sonnet' | 'grok' | 'groq'
export type AiProvider = 'openai-compatible'

export interface AiModelConfig {
  id: string
  displayName: string
  provider: AiProvider
  apiKeyEnv: string
  baseUrl?: string
  temperature: number
  maxTokens: number
  timeoutMs: number
  costPer1kInputUsd: number
  costPer1kOutputUsd: number
}

export interface AiRoutingConfig {
  defaultModel: AiModelKey
  taskModelMap: Record<string, AiModelKey>
  fallbackMap: Record<AiModelKey, AiModelKey>
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
  conversation: AiConversationConfig
  performance: AiPerformanceConfig
  systemPrompt?: string
}

const gatewayBaseUrl =
  getEnv('VERCEL_AI_GATEWAY_BASE_URL') ?? 'https://ai-gateway.vercel.sh/v1/chat/completions'

const modelAliases: Record<string, AiModelKey> = {
  sonnet: 'sonnet',
  'claude-sonnet': 'sonnet',
  opus: 'sonnet',
  grok: 'grok',
  'grok-4.1': 'grok',
  general: 'grok',
  groq: 'groq',
  'llama-3.3-70b': 'groq',
  haiku: 'groq',
  tech: 'groq'
}

const resolveModelKey = (value?: string): AiModelKey | undefined => {
  if (!value) return undefined
  return modelAliases[value.toLowerCase()]
}

const defaultModel = resolveModelKey(getEnv('AI_DEFAULT_MODEL')) ?? 'grok'

export const defaultAiConfig: AiConfig = {
  models: {
    sonnet: {
      id: 'anthropic/claude-sonnet-4.5',
      displayName: 'Claude Sonnet 4.5',
      provider: 'openai-compatible',
      apiKeyEnv: 'VERCEL_AI_GATEWAY_API_KEY',
      baseUrl: gatewayBaseUrl,
      temperature: 0.4,
      maxTokens: 4096,
      timeoutMs: 45_000,
      costPer1kInputUsd: 0.0,
      costPer1kOutputUsd: 0.0
    },
    grok: {
      id: 'xai/grok-4.1',
      displayName: 'Grok 4.1 Reasoning',
      provider: 'openai-compatible',
      apiKeyEnv: 'VERCEL_AI_GATEWAY_API_KEY',
      baseUrl: gatewayBaseUrl,
      temperature: 0.4,
      maxTokens: 2048,
      timeoutMs: 30_000,
      costPer1kInputUsd: 0.0,
      costPer1kOutputUsd: 0.0
    },
    groq: {
      id: getEnv('GROQ_TECHNICAL_MODEL') ?? 'groq/llama-3.3-70b-versatile',
      displayName: 'Groq Llama 3.3 70B',
      provider: 'openai-compatible',
      apiKeyEnv: 'VERCEL_AI_GATEWAY_API_KEY',
      baseUrl: gatewayBaseUrl,
      temperature: 0.25,
      maxTokens: 2048,
      timeoutMs: 20_000,
      costPer1kInputUsd: 0.0,
      costPer1kOutputUsd: 0.0
    }
  },
  routing: {
    defaultModel,
    taskModelMap: {
      analysis: 'groq',
      research: 'sonnet',
      reasoning: 'sonnet',
      technical: 'groq',
      'quick-pulse': 'groq',
      'quickpulse': 'groq',
      news: 'grok',
      sentiment: 'grok',
      chat: 'grok',
      general: 'grok'
    },
    fallbackMap: {
      sonnet: 'grok',
      grok: 'groq',
      groq: 'sonnet'
    }
  },
  conversation: {
    maxHistoryMessages: Number.parseInt(getEnv('AI_MAX_HISTORY_MESSAGES') ?? '24', 10)
  },
  performance: {
    slowResponseMs: Number.parseInt(getEnv('AI_SLOW_RESPONSE_MS') ?? '3000', 10)
  },
  systemPrompt: getEnv('AI_SYSTEM_PROMPT')
}
