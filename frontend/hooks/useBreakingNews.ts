import { useEffect, useRef } from 'react'
import type { RiskFlowItem } from '../types/api'

export function useBreakingNews(onBreaking: (item: RiskFlowItem) => void) {
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const baseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
    const streamUrl = `${baseUrl}/api/riskflow/stream`
    const source = new EventSource(streamUrl)
    sourceRef.current = source

    source.onmessage = (event) => {
      try {
        const item = JSON.parse(event.data) as RiskFlowItem
        onBreaking(item)
      } catch (error) {
        console.warn('[BreakingNews] Failed to parse SSE payload', error)
      }
    }

    source.onerror = (event) => {
      console.warn('[BreakingNews] SSE error, letting browser retry', event)
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [onBreaking])
}
