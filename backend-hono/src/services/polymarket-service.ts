/**
 * Polymarket Service
 * Fetches markets from Polymarket public API, normalizes, and caches.
 */

import type { PolymarketMarket, PolymarketOddsResponse } from '../types/polymarket.js'

const POLY_API = 'https://gamma-api.polymarket.com/markets'
const CACHE_TTL_MS = 60_000 // 1 minute

let cache: { data: PolymarketOddsResponse; expires: number } | null = null

const hasFetch = typeof fetch !== 'undefined'

function ensureFetch() {
  if (!hasFetch) throw new Error('Global fetch not available')
}

function normalize(raw: any): PolymarketMarket | null {
  if (!raw || !raw.id || !raw.question || !Array.isArray(raw.outcomes) || !Array.isArray(raw.prices)) return null
  const bestOutcomeIndex = raw.prices?.reduce(
    (best: number, p: number, idx: number) => (p > raw.prices[best] ? idx : best),
    0
  )
  const probability = raw.prices?.[bestOutcomeIndex] ?? null
  if (probability === null) return null
  return {
    id: String(raw.id),
    title: String(raw.question),
    outcome: String(raw.outcomes[bestOutcomeIndex] ?? 'Yes'),
    probability: Number(probability),
    volume24h: raw.volume24h ? Number(raw.volume24h) : undefined,
    liquidity: raw.liquidity ? Number(raw.liquidity) : undefined,
    closeTime: raw.endDate ? new Date(raw.endDate).toISOString() : undefined,
    url: raw.slug ? `https://polymarket.com/event/${raw.slug}` : undefined,
  }
}

export async function fetchPolymarket(): Promise<PolymarketOddsResponse> {
  ensureFetch()

  if (cache && Date.now() < cache.expires) {
    return cache.data
  }

  const resp = await fetch(POLY_API)
  if (!resp.ok) {
    throw new Error(`Polymarket fetch failed: ${resp.status}`)
  }
  const json = await resp.json()
  const markets = Array.isArray(json) ? json : (json && Array.isArray((json as any).data) ? (json as any).data : [])
  const normalized = markets
    .map(normalize)
    .filter((m): m is PolymarketMarket => m !== null)
    // Filter to macro-relevant markets (rough heuristic)
    .filter(m =>
      ['fed', 'inflation', 'cpi', 'ppi', 'election', 'recession', 'rate', 'nfp', 'gdp'].some(key =>
        m.title.toLowerCase().includes(key)
      )
    )

  const data: PolymarketOddsResponse = {
    markets: normalized,
    fetchedAt: new Date().toISOString(),
  }
  cache = { data, expires: Date.now() + CACHE_TTL_MS }
  return data
}
