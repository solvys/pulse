export interface BrokerAccountRow {
    id: number;
    account_id: string;
    account_name: string;
    account_type: string | null;
    balance: number;
    equity: number;
    margin_used: number;
    buying_power: number;
    last_synced_at: Date | null;
}
export interface TradeRow {
    id: number;
    user_id: string;
    account_id: number;
    contract_id: string | null;
    symbol: string | null;
    side: string;
    size: number;
    entry_price: number | null;
    exit_price: number | null;
    pnl: number | null;
    opened_at: Date;
    closed_at: Date | null;
    strategy: string | null;
    notes: string | null;
}
export interface CalendarDayRow {
    date: string;
    pnl: number;
    trade_count: number;
}
export interface PnlByTimeRow {
    hour: number;
    pnl: number;
}
export interface OrderRow {
    id: number;
    time: Date;
    symbol: string;
    side: string;
    size: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
}
export interface ERScoreRow {
    hour: number;
    score: number;
}
export interface TradePatternRow {
    hour: number;
    trade_count: number;
    losses: number;
    revenge_trades: number;
}
export interface BlindspotPatternRow {
    total_trades: number;
    revenge_count: number;
    off_hours_count: number;
    avg_size: number;
    max_size: number;
}
export interface NewsArticleRow {
    id: number;
    title: string;
    summary: string | null;
    content: string | null;
    source: string | null;
    url: string | null;
    published_at: Date | null;
    sentiment: string | null;
    iv_impact: number | null;
    symbols: string[] | null;
    is_breaking: boolean;
    macro_level: number | null;
    price_brain_sentiment: string | null;
    price_brain_classification: string | null;
    implied_points: number | null;
    instrument: string | null;
    author_handle: string | null;
}
export interface EconPlanRow {
    plan: string;
    events: unknown;
    source: string;
    cached_at: Date;
}
export type PolymarketMarketType = 'rate_cut' | 'cpi' | 'nfp' | 'interest_rate' | 'jerome_powell' | 'donald_trump_tariffs' | 'politics' | 'gdp' | 'interest_rate_futures';
export interface PolymarketOddsRow {
    id: number;
    market_id: string;
    market_type: PolymarketMarketType;
    yes_odds: number;
    no_odds: number;
    timestamp: Date;
    created_at: Date;
}
export interface PolymarketUpdateRow {
    id: number;
    market_type: PolymarketMarketType;
    previous_odds: number;
    current_odds: number;
    change_percentage: number;
    triggered_by_news_id: number | null;
    created_at: Date;
}
//# sourceMappingURL=db.d.ts.map