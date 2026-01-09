import { createOpenAI } from '@ai-sdk/openai'
import { generateText, streamText, type LanguageModel } from 'ai'
import {
  defaultAiConfig,
  type AiConfig,
  type AiModelConfig,
  type AiModelKey,
  getCrossProviderEquivalent
} from '../config/ai-config'
import type { AiProviderType } from '../types/ai-types'
import { createOpenRouterClient } from './openrouter-service'
import { getProviderHealthService, type ProviderHealthService } from './provider-health'
import {
  extractTokenUsage,
  createCostRecord,
  getCostTracker,
  type CostTracker
} from '../utils/ai-cost-tracker'

// Type alias for model clients - both providers return LanguageModelV1-compatible models
type ModelClient = LanguageModel

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ModelUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export interface ModelMetrics {
  totalRequests: number
  totalCompleted: number
  totalErrors: number
  totalTokens: number
  totalCostUsd: number
  totalLatencyMs: number
  avgLatencyMs: number
  lastLatencyMs: number
  lastError?: string
  lastUsedAt?: string
}

export interface ModelSelection {
  model: AiModelKey
  provider: AiProviderType
  reason: string
  fallbackChain: AiModelKey[]
}

export interface StreamFinish {
  text: string
  usage?: ModelUsage
  model: AiModelKey
  provider: AiProviderType
  finishReason?: string
  costUsd?: number
  latencyMs: number
}

export interface StreamChatOptions {
  model: AiModelKey
  messages: AiMessage[]
  temperature?: number
  maxTokens?: number
  userId?: string
  onFinish?: (data: StreamFinish) => void | Promise<void>
}

export interface GenerateChatOptions {
  model: AiModelKey
  messages: AiMessage[]
  temperature?: number
  maxTokens?: number
  userId?: string
}

const telemetryOptions = {
  experimental_telemetry: {
    isEnabled: true,
    recordInputs: true,
    recordOutputs: true
  }
}

const getEnv = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.[key]
}

const defaultGatewayBaseUrl =
  getEnv('VERCEL_AI_GATEWAY_BASE_URL') ?? 'https://ai-gateway.vercel.sh/v1/chat/completions'

const buildMetrics = (): Record<AiModelKey, ModelMetrics> => {
  const keys: AiModelKey[] = [
    'sonnet',
    'grok',
    'groq',
    'openrouter-sonnet',
    'openrouter-llama'
  ]

  const metrics: Partial<Record<AiModelKey, ModelMetrics>> = {}
  for (const key of keys) {
    metrics[key] = {
      totalRequests: 0,
      totalCompleted: 0,
      totalErrors: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      lastLatencyMs: 0
    }
  }
  return metrics as Record<AiModelKey, ModelMetrics>
}

const isRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const status = (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode
  const message = 'message' in error ? String((error as { message?: string }).message) : ''
  return status === 429 || message.toLowerCase().includes('rate limit')
}

const isRetryableModelError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const status =
    (error as { status?: number }).status ??
    (error as { statusCode?: number }).statusCode ??
    null
  if (status && [408, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true
  }
  const code = 'code' in error ? String((error as { code?: string }).code) : ''
  if (code && ['etimedout', 'econnreset', 'fetch_failed'].includes(code.toLowerCase())) {
    return true
  }
  const message = 'message' in error ? String((error as { message?: string }).message).toLowerCase() : ''
  return message.includes('timeout') || message.includes('network') || message.includes('fetch')
}

const normalizeTaskType = (taskType?: string): string | undefined => {
  if (!taskType) return undefined
  return taskType.trim().toLowerCase()
}

export interface AiModelServiceDeps {
  config?: AiConfig
  healthService?: ProviderHealthService
  costTracker?: CostTracker
}

export const createAiModelService = (deps: AiModelServiceDeps = {}) => {
  const config = deps.config ?? defaultAiConfig
  const healthService = deps.healthService ?? getProviderHealthService()
  const costTracker = deps.costTracker ?? getCostTracker()
  const metrics = buildMetrics()
  const modelCache = new Map<AiModelKey, ModelClient>()

  const resolveApiKey = (modelConfig: AiModelConfig): string | undefined =>
    getEnv(modelConfig.apiKeyEnv)

  /**
   * Build a Vercel Gateway client (existing behavior)
   */
  const buildVercelGatewayClient = (modelConfig: AiModelConfig) => {
    const apiKey = resolveApiKey(modelConfig)
    if (!apiKey) {
      const message = `Missing API key for ${modelConfig.displayName} (env: ${modelConfig.apiKeyEnv})`
      console.error('[ai] model api key missing', {
        model: modelConfig.displayName,
        provider: modelConfig.providerType,
        apiKeyEnv: modelConfig.apiKeyEnv
      })
      const error = new Error(message) as Error & { status?: number; statusCode?: number }
      error.status = 500
      error.statusCode = 500
      throw error
    }

    const baseUrl = modelConfig.baseUrl ?? defaultGatewayBaseUrl
    if (!baseUrl) {
      const message = `Missing baseUrl for ${modelConfig.displayName}`
      console.error('[ai] model baseUrl missing', {
        model: modelConfig.displayName,
        provider: modelConfig.providerType
      })
      const error = new Error(message) as Error & { status?: number; statusCode?: number }
      error.status = 500
      error.statusCode = 500
      throw error
    }

    const openai = createOpenAI({ apiKey, baseURL: baseUrl })
    return openai(modelConfig.id)
  }

  /**
   * Build an OpenRouter client
   */
  const buildOpenRouterClient = (modelConfig: AiModelConfig) => {
    return createOpenRouterClient(modelConfig)
  }

  /**
   * Build client based on provider type
   * Both providers return LanguageModelV1-compatible models
   */
  const buildModelClient = (modelConfig: AiModelConfig): ModelClient => {
    if (modelConfig.providerType === 'openrouter') {
      return buildOpenRouterClient(modelConfig) as unknown as ModelClient
    }
    return buildVercelGatewayClient(modelConfig) as unknown as ModelClient
  }

  const getModelClient = (modelKey: AiModelKey) => {
    const cached = modelCache.get(modelKey)
    if (cached) return cached
    const modelConfig = config.models[modelKey]
    const client = buildModelClient(modelConfig)
    modelCache.set(modelKey, client)
    return client
  }

  const recordSuccess = (
    modelKey: AiModelKey,
    latencyMs: number,
    usage?: ModelUsage,
    costUsd?: number
  ) => {
    const metric = metrics[modelKey]
    const modelConfig = config.models[modelKey]

    metric.totalCompleted += 1
    metric.totalLatencyMs += latencyMs
    metric.lastLatencyMs = latencyMs
    metric.avgLatencyMs = Math.round(metric.totalLatencyMs / metric.totalCompleted)
    metric.lastUsedAt = new Date().toISOString()
    if (usage?.totalTokens) {
      metric.totalTokens += usage.totalTokens
    }
    if (costUsd) {
      metric.totalCostUsd += costUsd
    }

    // Record in provider health service
    healthService.recordSuccess(modelConfig.providerType, latencyMs, costUsd)
  }

  const recordError = (modelKey: AiModelKey, error: unknown) => {
    const metric = metrics[modelKey]
    const modelConfig = config.models[modelKey]

    metric.totalErrors += 1
    metric.lastError = error instanceof Error ? error.message : String(error)

    // Record in provider health service
    healthService.recordFailure(modelConfig.providerType, error)
  }

  /**
   * Build fallback chain for a model
   * Includes same-provider fallback and cross-provider fallback
   */
  const buildFallbackChain = (modelKey: AiModelKey): AiModelKey[] => {
    const chain: AiModelKey[] = []
    const visited = new Set<AiModelKey>()
    let current: AiModelKey | null = modelKey

    // Add same-provider fallbacks
    while (current !== null && !visited.has(current)) {
      visited.add(current)
      const nextModel: AiModelKey | undefined = config.routing.fallbackMap[current]
      if (nextModel && nextModel !== current) {
        chain.push(nextModel)
        current = nextModel
      } else {
        current = null
      }
    }

    // Add cross-provider fallback if enabled
    if (config.providers.enableFallback) {
      const crossFallback = getCrossProviderEquivalent(modelKey, config)
      if (crossFallback && !visited.has(crossFallback.model as AiModelKey)) {
        chain.push(crossFallback.model as AiModelKey)
      }
    }

    return chain
  }

  /**
   * Select the best model for a request
   */
  const selectModel = (options: {
    preferredModel?: AiModelKey
    taskType?: string
    messageCount?: number
    inputChars?: number
  }): ModelSelection => {
    let model: AiModelKey
    let reason: string

    // Check preferred model first
    if (options.preferredModel && config.models[options.preferredModel]) {
      model = options.preferredModel
      reason = 'preferred'
    } else {
      // Check task type mapping
      const normalizedTask = normalizeTaskType(options.taskType)
      if (normalizedTask && config.routing.taskModelMap[normalizedTask]) {
        model = config.routing.taskModelMap[normalizedTask]
        reason = 'task-map'
      } else {
        // Check task keywords
        const messageCount = options.messageCount ?? 0
        const inputChars = options.inputChars ?? 0

        if (normalizedTask) {
          if (
            normalizedTask.includes('quick') ||
            normalizedTask.includes('tech') ||
            normalizedTask.includes('analysis')
          ) {
            model = 'groq'
            reason = 'task-keyword'
          } else if (
            normalizedTask.includes('reason') ||
            normalizedTask.includes('interpret') ||
            normalizedTask.includes('research')
          ) {
            model = 'sonnet'
            reason = 'task-keyword'
          } else if (
            normalizedTask.includes('news') ||
            normalizedTask.includes('sentiment')
          ) {
            model = 'grok'
            reason = 'task-keyword'
          } else {
            model = config.routing.defaultModel
            reason = 'default'
          }
        } else if (messageCount > 12 || inputChars > 2000) {
          model = 'sonnet'
          reason = 'complexity'
        } else {
          model = config.routing.defaultModel
          reason = 'default'
        }
      }
    }

    // Check provider health and potentially switch
    const modelConfig = config.models[model]
    const providerHealthy = healthService.isProviderHealthy(modelConfig.providerType)

    if (!providerHealthy && config.providers.enableFallback) {
      const crossFallback = getCrossProviderEquivalent(model, config)
      if (crossFallback) {
        const fallbackHealthy = healthService.isProviderHealthy(crossFallback.provider)
        if (fallbackHealthy) {
          console.info('[ai] switching to cross-provider fallback due to unhealthy provider', {
            originalModel: model,
            originalProvider: modelConfig.providerType,
            fallbackModel: crossFallback.model,
            fallbackProvider: crossFallback.provider
          })
          model = crossFallback.model as AiModelKey
          reason = 'provider-fallback'
        }
      }
    }

    const provider = config.models[model].providerType
    const fallbackChain = buildFallbackChain(model)

    return { model, provider, reason, fallbackChain }
  }

  const getFallbackModel = (modelKey: AiModelKey): AiModelKey | null => {
    const fallback = config.routing.fallbackMap[modelKey]
    return fallback && fallback !== modelKey ? fallback : null
  }

  /**
   * Get cross-provider fallback for a model
   */
  const getCrossProviderFallback = (modelKey: AiModelKey): AiModelKey | null => {
    if (!config.providers.enableFallback) return null
    const equivalent = getCrossProviderEquivalent(modelKey, config)
    return equivalent ? (equivalent.model as AiModelKey) : null
  }

  /**
   * Stream chat with multi-provider fallback support
   */
  const streamChat = async (options: StreamChatOptions) => {
    const attempt = async (modelKey: AiModelKey, isFallback = false) => {
      const modelConfig = config.models[modelKey]
      const model = getModelClient(modelKey)
      const start = Date.now()
      const requestId = crypto.randomUUID()
      metrics[modelKey].totalRequests += 1

      console.info('[ai] stream request started', {
        model: modelKey,
        provider: modelConfig.providerType,
        isFallback,
        requestId
      })

      const result = await streamText({
        model,
        messages: options.messages,
        temperature: options.temperature ?? modelConfig.temperature,
        maxOutputTokens: options.maxTokens ?? modelConfig.maxTokens,
        experimental_telemetry: telemetryOptions.experimental_telemetry,
        onFinish: async (data) => {
          const latencyMs = Date.now() - start
          const usage = extractTokenUsage(data.usage)
          const costRecord = createCostRecord(modelConfig, usage)

          recordSuccess(modelKey, latencyMs, usage, costRecord.totalCostUsd)
          costTracker.recordCost(costRecord, options.userId)

          console.info('[ai] stream request completed', {
            model: modelKey,
            provider: modelConfig.providerType,
            latencyMs,
            tokens: usage?.totalTokens,
            costUsd: costRecord.totalCostUsd.toFixed(6),
            requestId
          })

          await options.onFinish?.({
            text: data.text,
            usage,
            model: modelKey,
            provider: modelConfig.providerType,
            finishReason: data.finishReason,
            costUsd: costRecord.totalCostUsd,
            latencyMs
          })
        }
      })

      return { result, model: modelKey, provider: modelConfig.providerType }
    }

    // Try primary model
    try {
      return await attempt(options.model)
    } catch (error) {
      recordError(options.model, error)
      const canFallback = isRateLimitError(error) || isRetryableModelError(error)

      if (!canFallback) {
        throw error
      }

      // Try same-provider fallback first
      const sameProviderFallback = getFallbackModel(options.model)
      if (sameProviderFallback) {
        console.warn('[ai] falling back to same-provider model', {
          from: options.model,
          to: sameProviderFallback,
          reason: error instanceof Error ? error.message : String(error)
        })
        try {
          return await attempt(sameProviderFallback, true)
        } catch (fallbackError) {
          recordError(sameProviderFallback, fallbackError)
          // Continue to cross-provider fallback
        }
      }

      // Try cross-provider fallback
      const crossProviderFallback = getCrossProviderFallback(options.model)
      if (crossProviderFallback) {
        console.warn('[ai] falling back to cross-provider model', {
          from: options.model,
          to: crossProviderFallback,
          reason: error instanceof Error ? error.message : String(error)
        })
        return await attempt(crossProviderFallback, true)
      }

      throw error
    }
  }

  /**
   * Generate chat with multi-provider fallback support
   */
  const generateChat = async (options: GenerateChatOptions) => {
    const attempt = async (modelKey: AiModelKey, isFallback = false) => {
      const modelConfig = config.models[modelKey]
      const model = getModelClient(modelKey)
      const start = Date.now()
      metrics[modelKey].totalRequests += 1

      console.info('[ai] generate request started', {
        model: modelKey,
        provider: modelConfig.providerType,
        isFallback
      })

      const result = await generateText({
        model,
        messages: options.messages,
        temperature: options.temperature ?? modelConfig.temperature,
        maxOutputTokens: options.maxTokens ?? modelConfig.maxTokens,
        experimental_telemetry: telemetryOptions.experimental_telemetry
      })

      const latencyMs = Date.now() - start
      const usage = extractTokenUsage(result.usage)
      const costRecord = createCostRecord(modelConfig, usage)

      recordSuccess(modelKey, latencyMs, usage, costRecord.totalCostUsd)
      costTracker.recordCost(costRecord, options.userId)

      console.info('[ai] generate request completed', {
        model: modelKey,
        provider: modelConfig.providerType,
        latencyMs,
        tokens: usage?.totalTokens,
        costUsd: costRecord.totalCostUsd.toFixed(6)
      })

      return {
        text: result.text,
        model: modelKey,
        provider: modelConfig.providerType,
        usage,
        costUsd: costRecord.totalCostUsd,
        latencyMs
      }
    }

    // Try primary model
    try {
      return await attempt(options.model)
    } catch (error) {
      recordError(options.model, error)
      const canFallback = isRateLimitError(error) || isRetryableModelError(error)

      if (!canFallback) {
        throw error
      }

      // Try same-provider fallback first
      const sameProviderFallback = getFallbackModel(options.model)
      if (sameProviderFallback) {
        console.warn('[ai] falling back to same-provider model', {
          from: options.model,
          to: sameProviderFallback,
          reason: error instanceof Error ? error.message : String(error)
        })
        try {
          return await attempt(sameProviderFallback, true)
        } catch (fallbackError) {
          recordError(sameProviderFallback, fallbackError)
          // Continue to cross-provider fallback
        }
      }

      // Try cross-provider fallback
      const crossProviderFallback = getCrossProviderFallback(options.model)
      if (crossProviderFallback) {
        console.warn('[ai] falling back to cross-provider model', {
          from: options.model,
          to: crossProviderFallback,
          reason: error instanceof Error ? error.message : String(error)
        })
        return await attempt(crossProviderFallback, true)
      }

      throw error
    }
  }

  return {
    selectModel,
    streamChat,
    generateChat,
    getMetrics: () => ({ ...metrics }),
    getProviderHealth: () => healthService.getAllMetrics(),
    getCostStats: () => costTracker.getAllStats()
  }
}
