import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { generateText, streamText } from 'ai'
import { defaultAiConfig, type AiConfig, type AiModelConfig, type AiModelKey } from '../config/ai-config'
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
  reason: string
}
export interface StreamFinish {
  text: string
  usage?: ModelUsage
  model: AiModelKey
  finishReason?: string
  costUsd?: number
  latencyMs: number
}
export interface StreamChatOptions {
  model: AiModelKey
  messages: AiMessage[]
  temperature?: number
  maxTokens?: number
  onFinish?: (data: StreamFinish) => void | Promise<void>
}
export interface GenerateChatOptions {
  model: AiModelKey
  messages: AiMessage[]
  temperature?: number
  maxTokens?: number
}
const getEnv = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.[key]
}

const buildMetrics = (): Record<AiModelKey, ModelMetrics> => ({
  opus: {
    totalRequests: 0,
    totalCompleted: 0,
    totalErrors: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    totalLatencyMs: 0,
    avgLatencyMs: 0,
    lastLatencyMs: 0
  },
  haiku: {
    totalRequests: 0,
    totalCompleted: 0,
    totalErrors: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    totalLatencyMs: 0,
    avgLatencyMs: 0,
    lastLatencyMs: 0
  },
  grok: {
    totalRequests: 0,
    totalCompleted: 0,
    totalErrors: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    totalLatencyMs: 0,
    avgLatencyMs: 0,
    lastLatencyMs: 0
  }
})

const isRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const status = (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode
  const message = 'message' in error ? String((error as { message?: string }).message) : ''
  return status === 429 || message.toLowerCase().includes('rate limit')
}

const extractUsage = (usage: unknown): ModelUsage | undefined => {
  if (!usage || typeof usage !== 'object') return undefined
  const raw = usage as Record<string, number | undefined>
  const inputTokens = raw.promptTokens ?? raw.inputTokens ?? raw.input_tokens
  const outputTokens = raw.completionTokens ?? raw.outputTokens ?? raw.output_tokens
  const totalTokens = raw.totalTokens ?? raw.total_tokens ?? (inputTokens ?? 0) + (outputTokens ?? 0)
  return {
    inputTokens,
    outputTokens,
    totalTokens
  }
}

const computeCost = (config: AiModelConfig, usage?: ModelUsage): number | undefined => {
  if (!usage) return undefined
  const input = usage.inputTokens ?? 0
  const output = usage.outputTokens ?? 0
  const inputCost = (input / 1000) * config.costPer1kInputUsd
  const outputCost = (output / 1000) * config.costPer1kOutputUsd
  return inputCost + outputCost
}

const normalizeTaskType = (taskType?: string): string | undefined => {
  if (!taskType) return undefined
  return taskType.trim().toLowerCase()
}

export const createAiModelService = (config: AiConfig = defaultAiConfig) => {
  const metrics = buildMetrics()
  const modelCache = new Map<AiModelKey, ReturnType<typeof anthropic> | ReturnType<typeof openai>>()

  const resolveApiKey = (modelConfig: AiModelConfig): string | undefined =>
    getEnv(modelConfig.apiKeyEnv)

  const buildModelClient = (modelConfig: AiModelConfig) => {
    const apiKey = resolveApiKey(modelConfig)
    if (!apiKey) {
      throw new Error(`Missing API key for ${modelConfig.displayName}`)
    }
    if (modelConfig.provider === 'anthropic') {
      return anthropic(modelConfig.id, { apiKey })
    }
    return openai(modelConfig.id, { apiKey, baseURL: modelConfig.baseUrl })
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
  }

  const recordError = (modelKey: AiModelKey, error: unknown) => {
    const metric = metrics[modelKey]
    metric.totalErrors += 1
    metric.lastError = error instanceof Error ? error.message : String(error)
  }

  const selectModel = (options: {
    preferredModel?: AiModelKey
    taskType?: string
    messageCount?: number
    inputChars?: number
  }): ModelSelection => {
    if (options.preferredModel && config.models[options.preferredModel]) {
      return { model: options.preferredModel, reason: 'preferred' }
    }
    const normalizedTask = normalizeTaskType(options.taskType)
    if (normalizedTask && config.routing.taskModelMap[normalizedTask]) {
      return { model: config.routing.taskModelMap[normalizedTask], reason: 'task-map' }
    }
    const messageCount = options.messageCount ?? 0
    const inputChars = options.inputChars ?? 0
    if (normalizedTask?.includes('news') || normalizedTask?.includes('sentiment')) {
      return { model: 'grok', reason: 'task-keyword' }
    }
    if (messageCount > 12 || inputChars > 2000) {
      return { model: 'opus', reason: 'complexity' }
    }
    return { model: config.routing.defaultModel, reason: 'default' }
  }

  const getFallbackModel = (modelKey: AiModelKey): AiModelKey | null => {
    const fallback = config.routing.fallbackMap[modelKey]
    return fallback && fallback !== modelKey ? fallback : null
  }

  const streamChat = async (options: StreamChatOptions) => {
    const attempt = async (modelKey: AiModelKey) => {
      const modelConfig = config.models[modelKey]
      const model = getModelClient(modelKey)
      const start = Date.now()
      metrics[modelKey].totalRequests += 1

      const result = await streamText({
        model,
        messages: options.messages,
        temperature: options.temperature ?? modelConfig.temperature,
        maxTokens: options.maxTokens ?? modelConfig.maxTokens,
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true
        },
        onFinish: async (data) => {
          const latencyMs = Date.now() - start
          const usage = extractUsage(data.usage)
          const costUsd = computeCost(modelConfig, usage)
          recordSuccess(modelKey, latencyMs, usage, costUsd)
          await options.onFinish?.({
            text: data.text,
            usage,
            model: modelKey,
            finishReason: data.finishReason,
            costUsd,
            latencyMs
          })
        }
      })

      return { result, model: modelKey }
    }

    try {
      return await attempt(options.model)
    } catch (error) {
      recordError(options.model, error)
      if (!isRateLimitError(error)) {
        throw error
      }
      const fallback = getFallbackModel(options.model)
      if (!fallback) {
        throw error
      }
      return attempt(fallback)
    }
  }

  const generateChat = async (options: GenerateChatOptions) => {
    const attempt = async (modelKey: AiModelKey) => {
      const modelConfig = config.models[modelKey]
      const model = getModelClient(modelKey)
      const start = Date.now()
      metrics[modelKey].totalRequests += 1

      const result = await generateText({
        model,
        messages: options.messages,
        temperature: options.temperature ?? modelConfig.temperature,
        maxTokens: options.maxTokens ?? modelConfig.maxTokens,
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true
        }
      })

      const latencyMs = Date.now() - start
      const usage = extractUsage(result.usage)
      const costUsd = computeCost(modelConfig, usage)
      recordSuccess(modelKey, latencyMs, usage, costUsd)
      return {
        text: result.text,
        model: modelKey,
        usage,
        costUsd,
        latencyMs
      }
    }

    try {
      return await attempt(options.model)
    } catch (error) {
      recordError(options.model, error)
      if (!isRateLimitError(error)) {
        throw error
      }
      const fallback = getFallbackModel(options.model)
      if (!fallback) {
        throw error
      }
      return attempt(fallback)
    }
  }

  return {
    selectModel,
    streamChat,
    generateChat,
    getMetrics: () => ({ ...metrics })
  }
}
