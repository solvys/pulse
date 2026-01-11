/**
 * OpenRouter Service
 * Provides OpenRouter-specific client configuration and utilities
 * for the multi-provider AI gateway architecture.
 */

import { createOpenAI } from '@ai-sdk/openai'
import type { AiModelConfig } from '../config/ai-config.js'
import type { OpenRouterMetadata, AiRequestCost } from '../types/ai-types.js'

// Environment access helper
const getEnv = (key: string): string | undefined => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env
  return env?.[key]
}

// OpenRouter API configuration
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export interface OpenRouterClientConfig {
  apiKey: string
  appUrl?: string
  appName?: string
  modelId: string
}

export interface OpenRouterHeaders {
  Authorization: string
  'HTTP-Referer': string
  'X-Title': string
  'Content-Type': string
}

/**
 * Build headers required by OpenRouter API
 * - HTTP-Referer: Your app URL for attribution
 * - X-Title: Your app name for OpenRouter dashboard
 */
export const buildOpenRouterHeaders = (config?: {
  appUrl?: string
  appName?: string
}): Partial<OpenRouterHeaders> => {
  const appUrl = config?.appUrl ?? getEnv('OPENROUTER_APP_URL') ?? 'https://pulse-solvys.vercel.app'
  const appName = config?.appName ?? getEnv('OPENROUTER_APP_NAME') ?? 'Pulse-AI-Gateway'

  return {
    'HTTP-Referer': appUrl,
    'X-Title': appName
  }
}

/**
 * Create an OpenRouter client using the AI SDK's OpenAI-compatible provider
 * OpenRouter implements the OpenAI API spec, so we use createOpenAI with custom baseURL
 */
export const createOpenRouterClient = (modelConfig: AiModelConfig) => {
  const apiKey = getEnv(modelConfig.apiKeyEnv)
  if (!apiKey) {
    const error = new Error(
      `Missing API key for OpenRouter (env: ${modelConfig.apiKeyEnv})`
    ) as Error & { status?: number; statusCode?: number }
    error.status = 500
    error.statusCode = 500
    throw error
  }

  const headers = buildOpenRouterHeaders()

  // Create OpenAI-compatible client pointing to OpenRouter
  const openrouter = createOpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    headers: headers as Record<string, string>
  })

  return openrouter(modelConfig.id)
}

/**
 * Parse OpenRouter-specific response headers for cost and rate limit info
 * OpenRouter returns metadata in X-OpenRouter-* headers
 */
export const parseOpenRouterResponseHeaders = (
  headers: Headers | Record<string, string>
): Partial<OpenRouterMetadata> => {
  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name)
    }
    return headers[name] ?? headers[name.toLowerCase()] ?? null
  }

  const metadata: Partial<OpenRouterMetadata> = {}

  // Parse cost from response (if available)
  const costHeader = getHeader('x-openrouter-cost')
  if (costHeader) {
    const cost = parseFloat(costHeader)
    if (!isNaN(cost)) {
      metadata.cost = cost
    }
  }

  // Parse rate limit info
  const rateLimitRemaining = getHeader('x-ratelimit-remaining')
  const rateLimitReset = getHeader('x-ratelimit-reset')

  if (rateLimitRemaining || rateLimitReset) {
    metadata.rateLimit = {}
    if (rateLimitRemaining) {
      const remaining = parseInt(rateLimitRemaining, 10)
      if (!isNaN(remaining)) {
        metadata.rateLimit.remaining = remaining
      }
    }
    if (rateLimitReset) {
      const reset = parseInt(rateLimitReset, 10)
      if (!isNaN(reset)) {
        metadata.rateLimit.reset = reset
      }
    }
  }

  // Parse model info
  const modelHeader = getHeader('x-openrouter-model')
  if (modelHeader) {
    metadata.model = modelHeader
  }

  return metadata
}

/**
 * Calculate cost from token usage and model config
 * Falls back to header-based cost if available
 */
export const calculateOpenRouterCost = (
  modelConfig: AiModelConfig,
  usage: { inputTokens?: number; outputTokens?: number },
  headerCost?: number
): AiRequestCost => {
  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const totalTokens = inputTokens + outputTokens

  // Calculate from config pricing
  const inputCostUsd = (inputTokens / 1000) * modelConfig.costPer1kInputUsd
  const outputCostUsd = (outputTokens / 1000) * modelConfig.costPer1kOutputUsd
  const calculatedTotalCost = inputCostUsd + outputCostUsd

  // Use header cost if available (more accurate), otherwise use calculated
  const totalCostUsd = headerCost ?? calculatedTotalCost

  return {
    provider: 'openrouter',
    model: modelConfig.id,
    inputTokens,
    outputTokens,
    totalTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd,
    timestamp: new Date().toISOString()
  }
}

/**
 * Check if an error is an OpenRouter rate limit error
 */
export const isOpenRouterRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const status =
    (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode
  if (status === 429) return true

  const message = 'message' in error ? String((error as { message?: string }).message) : ''
  return (
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('too many requests') ||
    message.toLowerCase().includes('quota exceeded')
  )
}

/**
 * Check if an error is retryable (network issues, temporary failures)
 */
export const isOpenRouterRetryableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  // Rate limits are retryable with backoff
  if (isOpenRouterRateLimitError(error)) return true

  const status =
    (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode ?? null

  // Server errors and timeouts are retryable
  if (status && [408, 425, 500, 502, 503, 504].includes(status)) {
    return true
  }

  // Network-level errors
  const code = 'code' in error ? String((error as { code?: string }).code) : ''
  if (code && ['etimedout', 'econnreset', 'fetch_failed', 'enotfound'].includes(code.toLowerCase())) {
    return true
  }

  const message = 'message' in error ? String((error as { message?: string }).message).toLowerCase() : ''
  return (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('econnrefused')
  )
}

/**
 * Calculate exponential backoff delay for retries
 */
export const calculateBackoffDelay = (
  attemptNumber: number,
  options?: {
    baseDelayMs?: number
    maxDelayMs?: number
    jitterFactor?: number
  }
): number => {
  const baseDelayMs = options?.baseDelayMs ?? 1000
  const maxDelayMs = options?.maxDelayMs ?? 30000
  const jitterFactor = options?.jitterFactor ?? 0.2

  // Exponential backoff: base * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber)

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs)

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * jitterFactor * (Math.random() - 0.5) * 2

  return Math.round(cappedDelay + jitter)
}

/**
 * Extract error details for logging
 */
export const extractOpenRouterErrorDetails = (
  error: unknown
): {
  status: number | null
  code: string | null
  message: string
  isRateLimit: boolean
  isRetryable: boolean
} => {
  const status =
    (error as { status?: number })?.status ??
    (error as { statusCode?: number })?.statusCode ??
    null

  const code = (error as { code?: string })?.code ?? null

  const message = error instanceof Error ? error.message : String(error)

  return {
    status,
    code,
    message,
    isRateLimit: isOpenRouterRateLimitError(error),
    isRetryable: isOpenRouterRetryableError(error)
  }
}

/**
 * OpenRouter model IDs used by Pulse
 * These provide alternative routes to the same models used via Vercel Gateway
 * Full list at: https://openrouter.ai/models
 */
export const OPENROUTER_MODELS = {
  // Anthropic - Claude Sonnet 4.5 equivalent
  CLAUDE_SONNET: 'anthropic/claude-sonnet-4',
  // Meta - Llama 3.3 70B (same as Groq via Vercel)
  LLAMA_3_3_70B: 'meta-llama/llama-3.3-70b-instruct'
} as const

export type OpenRouterModelId = (typeof OPENROUTER_MODELS)[keyof typeof OPENROUTER_MODELS]
