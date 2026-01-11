export interface PolymarketMarket {
  id: string
  title: string
  outcome: string
  probability: number // 0-1
  volume24h?: number
  liquidity?: number
  closeTime?: string
  url?: string
}

export interface PolymarketOddsResponse {
  markets: PolymarketMarket[]
  fetchedAt: string
}
