/**
 * Provider Health Service
 * Implements circuit breaker pattern for AI provider resilience.
 *
 * Circuit States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Provider is unhealthy, requests are rejected/rerouted
 * - HALF-OPEN: Testing if provider has recovered
 */

import type {
  AiProviderType,
  CircuitState,
  ProviderHealthStatus,
  ProviderMetrics
} from '../types/ai-types'

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  // Number of consecutive failures before opening circuit
  failureThreshold: number
  // Time in ms before attempting recovery (half-open state)
  recoveryTimeoutMs: number
  // Number of successful requests in half-open before closing circuit
  successThresholdInHalfOpen: number
  // Time window in ms for counting failures
  failureWindowMs: number
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeoutMs: 30_000,
  successThresholdInHalfOpen: 3,
  failureWindowMs: 60_000
}

// In-memory health state (per provider)
interface ProviderHealthState {
  consecutiveFailures: number
  consecutiveSuccesses: number
  circuitState: CircuitState
  lastFailureAt: number | null
  lastSuccessAt: number | null
  lastError: string | null
  circuitOpenedAt: number | null
  failureTimestamps: number[]
  latencies: number[]
}

/**
 * Create a provider health service instance
 * Manages circuit breaker state for each AI provider
 */
export const createProviderHealthService = (
  configOverrides?: Partial<Record<AiProviderType, Partial<CircuitBreakerConfig>>>
) => {
  // Per-provider health state
  const healthState: Record<AiProviderType, ProviderHealthState> = {
    openrouter: createInitialState(),
    'vercel-gateway': createInitialState()
  }

  // Per-provider config (with defaults)
  const config: Record<AiProviderType, CircuitBreakerConfig> = {
    openrouter: { ...DEFAULT_CIRCUIT_CONFIG, ...configOverrides?.openrouter },
    'vercel-gateway': { ...DEFAULT_CIRCUIT_CONFIG, ...configOverrides?.['vercel-gateway'] }
  }

  // Per-provider metrics
  const metrics: Record<AiProviderType, ProviderMetrics> = {
    openrouter: createInitialMetrics('openrouter'),
    'vercel-gateway': createInitialMetrics('vercel-gateway')
  }

  function createInitialState(): ProviderHealthState {
    return {
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      circuitState: 'closed',
      lastFailureAt: null,
      lastSuccessAt: null,
      lastError: null,
      circuitOpenedAt: null,
      failureTimestamps: [],
      latencies: []
    }
  }

  function createInitialMetrics(provider: AiProviderType): ProviderMetrics {
    return {
      provider,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      fallbackRequests: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      totalCostUsd: 0,
      errorRate: 0,
      lastUpdated: new Date().toISOString()
    }
  }

  /**
   * Clean old failure timestamps outside the window
   */
  function cleanFailureWindow(state: ProviderHealthState, windowMs: number): void {
    const cutoff = Date.now() - windowMs
    state.failureTimestamps = state.failureTimestamps.filter((ts) => ts > cutoff)
  }

  /**
   * Calculate percentile from sorted array
   */
  function percentile(sortedArr: number[], p: number): number {
    if (sortedArr.length === 0) return 0
    const index = Math.ceil((p / 100) * sortedArr.length) - 1
    return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))]
  }

  /**
   * Update latency metrics
   */
  function updateLatencyMetrics(provider: AiProviderType): void {
    const state = healthState[provider]
    const metric = metrics[provider]

    if (state.latencies.length === 0) return

    const sorted = [...state.latencies].sort((a, b) => a - b)
    metric.p50LatencyMs = percentile(sorted, 50)
    metric.p95LatencyMs = percentile(sorted, 95)
    metric.p99LatencyMs = percentile(sorted, 99)
    metric.avgLatencyMs = Math.round(metric.totalLatencyMs / metric.successfulRequests)

    // Keep only last 1000 latencies to avoid memory growth
    if (state.latencies.length > 1000) {
      state.latencies = state.latencies.slice(-1000)
    }
  }

  /**
   * Check if the circuit should transition from open to half-open
   */
  function shouldAttemptRecovery(provider: AiProviderType): boolean {
    const state = healthState[provider]
    const providerConfig = config[provider]

    if (state.circuitState !== 'open') return false
    if (!state.circuitOpenedAt) return false

    const elapsed = Date.now() - state.circuitOpenedAt
    return elapsed >= providerConfig.recoveryTimeoutMs
  }

  /**
   * Get current health status for a provider
   */
  function getHealthStatus(provider: AiProviderType): ProviderHealthStatus {
    const state = healthState[provider]

    // Check if we should transition to half-open
    if (shouldAttemptRecovery(provider)) {
      state.circuitState = 'half-open'
      console.info('[provider-health] circuit half-open, attempting recovery', { provider })
    }

    return {
      provider,
      isHealthy: state.circuitState === 'closed' || state.circuitState === 'half-open',
      consecutiveFailures: state.consecutiveFailures,
      consecutiveSuccesses: state.consecutiveSuccesses,
      lastFailureAt: state.lastFailureAt ? new Date(state.lastFailureAt).toISOString() : null,
      lastSuccessAt: state.lastSuccessAt ? new Date(state.lastSuccessAt).toISOString() : null,
      lastError: state.lastError,
      circuitState: state.circuitState,
      circuitOpenedAt: state.circuitOpenedAt
        ? new Date(state.circuitOpenedAt).toISOString()
        : null
    }
  }

  /**
   * Check if a provider is healthy (requests can proceed)
   */
  function isProviderHealthy(provider: AiProviderType): boolean {
    const status = getHealthStatus(provider)
    return status.isHealthy
  }

  /**
   * Record a successful request
   */
  function recordSuccess(provider: AiProviderType, latencyMs: number, costUsd?: number): void {
    const state = healthState[provider]
    const providerConfig = config[provider]
    const metric = metrics[provider]
    const now = Date.now()

    state.consecutiveSuccesses += 1
    state.consecutiveFailures = 0
    state.lastSuccessAt = now
    state.latencies.push(latencyMs)

    metric.totalRequests += 1
    metric.successfulRequests += 1
    metric.totalLatencyMs += latencyMs
    if (costUsd) {
      metric.totalCostUsd += costUsd
    }
    metric.errorRate = metric.failedRequests / metric.totalRequests
    metric.lastUpdated = new Date().toISOString()

    updateLatencyMetrics(provider)

    // Handle state transitions
    if (state.circuitState === 'half-open') {
      if (state.consecutiveSuccesses >= providerConfig.successThresholdInHalfOpen) {
        state.circuitState = 'closed'
        state.circuitOpenedAt = null
        console.info('[provider-health] circuit closed, provider recovered', {
          provider,
          consecutiveSuccesses: state.consecutiveSuccesses
        })
      }
    }
  }

  /**
   * Record a failed request
   */
  function recordFailure(provider: AiProviderType, error: unknown): void {
    const state = healthState[provider]
    const providerConfig = config[provider]
    const metric = metrics[provider]
    const now = Date.now()

    state.consecutiveFailures += 1
    state.consecutiveSuccesses = 0
    state.lastFailureAt = now
    state.lastError = error instanceof Error ? error.message : String(error)
    state.failureTimestamps.push(now)

    metric.totalRequests += 1
    metric.failedRequests += 1
    metric.errorRate = metric.failedRequests / metric.totalRequests
    metric.lastUpdated = new Date().toISOString()

    // Clean old failures outside the window
    cleanFailureWindow(state, providerConfig.failureWindowMs)

    // Check if we should open the circuit
    if (state.circuitState === 'closed') {
      if (
        state.consecutiveFailures >= providerConfig.failureThreshold ||
        state.failureTimestamps.length >= providerConfig.failureThreshold
      ) {
        state.circuitState = 'open'
        state.circuitOpenedAt = now
        console.warn('[provider-health] circuit opened, provider unhealthy', {
          provider,
          consecutiveFailures: state.consecutiveFailures,
          recentFailures: state.failureTimestamps.length,
          lastError: state.lastError
        })
      }
    } else if (state.circuitState === 'half-open') {
      // Any failure in half-open goes back to open
      state.circuitState = 'open'
      state.circuitOpenedAt = now
      console.warn('[provider-health] circuit re-opened, recovery failed', {
        provider,
        lastError: state.lastError
      })
    }
  }

  /**
   * Record a fallback request (when we had to use alternate provider)
   */
  function recordFallback(provider: AiProviderType): void {
    const metric = metrics[provider]
    metric.fallbackRequests += 1
    metric.lastUpdated = new Date().toISOString()
  }

  /**
   * Get metrics for a provider
   */
  function getMetrics(provider: AiProviderType): ProviderMetrics {
    return { ...metrics[provider] }
  }

  /**
   * Get metrics for all providers
   */
  function getAllMetrics(): Record<AiProviderType, ProviderMetrics> {
    return {
      openrouter: getMetrics('openrouter'),
      'vercel-gateway': getMetrics('vercel-gateway')
    }
  }

  /**
   * Reset health state for a provider (useful for testing or manual intervention)
   */
  function resetProvider(provider: AiProviderType): void {
    healthState[provider] = createInitialState()
    console.info('[provider-health] provider state reset', { provider })
  }

  /**
   * Force open the circuit for a provider (useful for maintenance)
   */
  function forceOpenCircuit(provider: AiProviderType): void {
    const state = healthState[provider]
    state.circuitState = 'open'
    state.circuitOpenedAt = Date.now()
    console.warn('[provider-health] circuit force-opened', { provider })
  }

  /**
   * Force close the circuit for a provider (useful for recovery)
   */
  function forceCloseCircuit(provider: AiProviderType): void {
    const state = healthState[provider]
    state.circuitState = 'closed'
    state.circuitOpenedAt = null
    state.consecutiveFailures = 0
    state.failureTimestamps = []
    console.info('[provider-health] circuit force-closed', { provider })
  }

  /**
   * Get the best available provider based on health status
   */
  function getBestProvider(
    preferred: AiProviderType,
    fallback: AiProviderType
  ): AiProviderType {
    if (isProviderHealthy(preferred)) {
      return preferred
    }

    if (isProviderHealthy(fallback)) {
      console.info('[provider-health] using fallback provider', {
        preferred,
        fallback,
        preferredState: healthState[preferred].circuitState
      })
      recordFallback(preferred)
      return fallback
    }

    // Both unhealthy, try preferred anyway (may recover)
    console.warn('[provider-health] all providers unhealthy, trying preferred', {
      preferred,
      fallback
    })
    return preferred
  }

  return {
    getHealthStatus,
    isProviderHealthy,
    recordSuccess,
    recordFailure,
    recordFallback,
    getMetrics,
    getAllMetrics,
    resetProvider,
    forceOpenCircuit,
    forceCloseCircuit,
    getBestProvider
  }
}

// Singleton instance for global use
let globalHealthService: ReturnType<typeof createProviderHealthService> | null = null

export const getProviderHealthService = () => {
  if (!globalHealthService) {
    globalHealthService = createProviderHealthService()
  }
  return globalHealthService
}

// Export type for dependency injection
export type ProviderHealthService = ReturnType<typeof createProviderHealthService>
