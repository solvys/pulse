import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import type { RiskFlowItem } from '../types/api'

/**
 * useRiskFlow Hook
 * Connects to RiskFlow SSE stream for real-time Level 4 news alerts
 */
export function useRiskFlow(onItem: (item: RiskFlowItem) => void) {
  const sourceRef = useRef<EventSource | null>(null)
  const { getToken, isSignedIn } = useAuth()

  useEffect(() => {
    // Don't connect if user is not signed in
    if (!isSignedIn) {
      console.warn('[RiskFlow] User not signed in, skipping SSE connection')
      return
    }

    let mounted = true

    const connectSSE = async () => {
      try {
        // Get auth token for SSE (EventSource can't send headers)
        const token = await getToken({ template: 'neon' }) || await getToken()
        
        if (!token) {
          console.warn('[RiskFlow] No auth token available, skipping SSE connection')
          return
        }

        if (!mounted) return

        const baseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
        // EventSource doesn't support custom headers, so pass token as query param
        const streamUrl = `${baseUrl}/api/riskflow/stream?token=${encodeURIComponent(token)}`
        
        const source = new EventSource(streamUrl)
        sourceRef.current = source

        source.onopen = () => {
          console.log('[RiskFlow] SSE connection opened')
        }

        source.onmessage = (event) => {
          try {
            // Skip heartbeat messages
            if (event.data.trim() === '' || event.data.startsWith(':')) {
              return
            }
            const item = JSON.parse(event.data) as RiskFlowItem
            onItem(item)
          } catch (error) {
            console.warn('[RiskFlow] Failed to parse SSE payload', error)
          }
        }

        source.onerror = (event) => {
          console.warn('[RiskFlow] SSE error, letting browser retry', event)
          // EventSource will automatically retry, but we can log the state
          if (source.readyState === EventSource.CLOSED) {
            console.warn('[RiskFlow] SSE connection closed, will retry automatically')
          }
        }
      } catch (error) {
        console.error('[RiskFlow] Failed to establish SSE connection', error)
      }
    }

    connectSSE()

    return () => {
      mounted = false
      if (sourceRef.current) {
        sourceRef.current.close()
        sourceRef.current = null
      }
    }
  }, [onItem, getToken, isSignedIn])
}

// Backward compatibility alias
export const useBreakingNews = useRiskFlow
