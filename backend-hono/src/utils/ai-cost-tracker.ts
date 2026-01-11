/**
 * AI Cost Tracker Utility
 * Unified cost calculation and tracking for multi-provider AI architecture.
 * Supports both OpenRouter and Vercel Gateway providers.
 */

import type { AiModelConfig } from '../config/ai-config.js'
import type { AiProviderType, AiRequestCost, AiCostStats } from '../types/ai-types.js'

// Token usage interface (normalized across providers)
export interface TokenUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  // Alternative field names from different providers
  promptTokens?: number
  completionTokens?: number
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
}

// Cost calculation result
export interface CostCalculation {
  inputCostUsd: number
  outputCostUsd: number
  totalCostUsd: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

// In-memory cost aggregation
export interface CostAggregation {
  byProvider: Record<AiProviderType, AiCostStats>
  byModel: Record<string, AiCostStats>
  byUser: Record<string, AiCostStats>
  total: AiCostStats
}

/**
 * Extract normalized token counts from various usage formats
 * Different providers use different field names
 */
export const extractTokenUsage = (usage: unknown): TokenUsage | undefined => {
  if (!usage || typeof usage !== 'object') return undefined

  const raw = usage as Record<string, number | undefined>

  // Normalize field names
  const inputTokens =
    raw.promptTokens ?? raw.inputTokens ?? raw.input_tokens ?? undefined
  const outputTokens =
    raw.completionTokens ?? raw.outputTokens ?? raw.output_tokens ?? undefined
  const calculatedTotal = (inputTokens ?? 0) + (outputTokens ?? 0)
  const totalTokens =
    raw.totalTokens ??
    raw.total_tokens ??
    (calculatedTotal > 0 ? calculatedTotal : undefined)

  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens
  }
}

/**
 * Calculate cost based on model config and token usage
 */
export const calculateCost = (
  modelConfig: AiModelConfig,
  usage: TokenUsage | undefined
): CostCalculation => {
  const inputTokens = usage?.inputTokens ?? 0
  const outputTokens = usage?.outputTokens ?? 0
  const totalTokens = usage?.totalTokens ?? inputTokens + outputTokens

  const inputCostUsd = (inputTokens / 1000) * modelConfig.costPer1kInputUsd
  const outputCostUsd = (outputTokens / 1000) * modelConfig.costPer1kOutputUsd
  const totalCostUsd = inputCostUsd + outputCostUsd

  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd,
    inputTokens,
    outputTokens,
    totalTokens
  }
}

/**
 * Create a cost request record for logging/persistence
 */
export const createCostRecord = (
  modelConfig: AiModelConfig,
  usage: TokenUsage | undefined,
  overrideCost?: number
): AiRequestCost => {
  const calculation = calculateCost(modelConfig, usage)

  return {
    provider: modelConfig.providerType,
    model: modelConfig.id,
    inputTokens: calculation.inputTokens,
    outputTokens: calculation.outputTokens,
    totalTokens: calculation.totalTokens,
    inputCostUsd: calculation.inputCostUsd,
    outputCostUsd: calculation.outputCostUsd,
    // Use override cost if provided (e.g., from OpenRouter headers)
    totalCostUsd: overrideCost ?? calculation.totalCostUsd,
    timestamp: new Date().toISOString()
  }
}

/**
 * Create a cost tracker instance for aggregating costs
 */
export const createCostTracker = () => {
  const aggregation: CostAggregation = {
    byProvider: {
      openrouter: createEmptyStats('openrouter'),
      'vercel-gateway': createEmptyStats('vercel-gateway')
    },
    byModel: {},
    byUser: {},
    total: createEmptyStats('openrouter') // Provider field not meaningful for total
  }

  function createEmptyStats(provider: AiProviderType): AiCostStats {
    const now = new Date().toISOString()
    return {
      provider,
      totalRequests: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      avgCostPerRequest: 0,
      periodStart: now,
      periodEnd: now
    }
  }

  function updateStats(stats: AiCostStats, cost: AiRequestCost): void {
    stats.totalRequests += 1
    stats.totalTokens += cost.totalTokens
    stats.totalCostUsd += cost.totalCostUsd
    stats.avgCostPerRequest = stats.totalCostUsd / stats.totalRequests
    stats.periodEnd = cost.timestamp
  }

  /**
   * Record a cost for aggregation
   */
  function recordCost(cost: AiRequestCost, userId?: string): void {
    // Update provider stats
    updateStats(aggregation.byProvider[cost.provider], cost)

    // Update model stats
    if (!aggregation.byModel[cost.model]) {
      aggregation.byModel[cost.model] = createEmptyStats(cost.provider)
    }
    updateStats(aggregation.byModel[cost.model], cost)

    // Update user stats
    if (userId) {
      if (!aggregation.byUser[userId]) {
        aggregation.byUser[userId] = createEmptyStats(cost.provider)
      }
      updateStats(aggregation.byUser[userId], cost)
    }

    // Update total
    updateStats(aggregation.total, cost)

    // Log for billing analysis
    console.info('[ai-cost] request recorded', {
      provider: cost.provider,
      model: cost.model,
      tokens: cost.totalTokens,
      costUsd: cost.totalCostUsd.toFixed(6),
      userId: userId ?? 'anonymous'
    })
  }

  /**
   * Get stats by provider
   */
  function getProviderStats(provider: AiProviderType): AiCostStats {
    return { ...aggregation.byProvider[provider] }
  }

  /**
   * Get stats by model
   */
  function getModelStats(modelId: string): AiCostStats | null {
    const stats = aggregation.byModel[modelId]
    return stats ? { ...stats } : null
  }

  /**
   * Get stats by user
   */
  function getUserStats(userId: string): AiCostStats | null {
    const stats = aggregation.byUser[userId]
    return stats ? { ...stats } : null
  }

  /**
   * Get total stats
   */
  function getTotalStats(): AiCostStats {
    return { ...aggregation.total }
  }

  /**
   * Get all stats
   */
  function getAllStats(): CostAggregation {
    return {
      byProvider: {
        openrouter: getProviderStats('openrouter'),
        'vercel-gateway': getProviderStats('vercel-gateway')
      },
      byModel: { ...aggregation.byModel },
      byUser: { ...aggregation.byUser },
      total: getTotalStats()
    }
  }

  /**
   * Reset all stats (e.g., for new billing period)
   */
  function resetStats(): void {
    const now = new Date().toISOString()
    aggregation.byProvider = {
      openrouter: createEmptyStats('openrouter'),
      'vercel-gateway': createEmptyStats('vercel-gateway')
    }
    aggregation.byModel = {}
    aggregation.byUser = {}
    aggregation.total = createEmptyStats('openrouter')
    aggregation.total.periodStart = now

    console.info('[ai-cost] stats reset', { periodStart: now })
  }

  /**
   * Export stats for external logging/persistence
   */
  function exportStats(): string {
    return JSON.stringify(getAllStats(), null, 2)
  }

  return {
    recordCost,
    getProviderStats,
    getModelStats,
    getUserStats,
    getTotalStats,
    getAllStats,
    resetStats,
    exportStats
  }
}

// Singleton instance for global use
let globalCostTracker: ReturnType<typeof createCostTracker> | null = null

export const getCostTracker = () => {
  if (!globalCostTracker) {
    globalCostTracker = createCostTracker()
  }
  return globalCostTracker
}

// Export type for dependency injection
export type CostTracker = ReturnType<typeof createCostTracker>

/**
 * Format cost for display (e.g., "$0.001234")
 */
export const formatCostUsd = (costUsd: number): string => {
  if (costUsd < 0.01) {
    return `$${costUsd.toFixed(6)}`
  }
  if (costUsd < 1) {
    return `$${costUsd.toFixed(4)}`
  }
  return `$${costUsd.toFixed(2)}`
}

/**
 * Estimate cost before making a request
 * Useful for budget checking and cost optimization
 */
export const estimateCost = (
  modelConfig: AiModelConfig,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): CostCalculation => {
  return calculateCost(modelConfig, {
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens
  })
}

/**
 * Compare costs between two models
 */
export const compareCosts = (
  modelA: AiModelConfig,
  modelB: AiModelConfig,
  inputTokens: number,
  outputTokens: number
): {
  modelA: CostCalculation
  modelB: CostCalculation
  savings: number
  savingsPercent: number
  cheaperModel: string
} => {
  const costA = estimateCost(modelA, inputTokens, outputTokens)
  const costB = estimateCost(modelB, inputTokens, outputTokens)

  const cheaper = costA.totalCostUsd <= costB.totalCostUsd ? modelA : modelB
  const moreExpensive = costA.totalCostUsd <= costB.totalCostUsd ? modelB : modelA
  const cheaperCost = Math.min(costA.totalCostUsd, costB.totalCostUsd)
  const expensiveCost = Math.max(costA.totalCostUsd, costB.totalCostUsd)

  const savings = expensiveCost - cheaperCost
  const savingsPercent = expensiveCost > 0 ? (savings / expensiveCost) * 100 : 0

  return {
    modelA: costA,
    modelB: costB,
    savings,
    savingsPercent,
    cheaperModel: cheaper.id
  }
}
