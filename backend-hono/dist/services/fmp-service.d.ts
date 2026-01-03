/**
 * Financial Modeling Prep (FMP) Service
 * Tertiary source for general financial news and economic calendar
 */
export interface FMPArticle {
    symbol: string;
    publishedDate: string;
    title: string;
    image: string;
    site: string;
    text: string;
    url: string;
}
export interface FMPCalendarEvent {
    event: string;
    currency: string;
    date: string;
    country: string;
    impact: 'Low' | 'Medium' | 'High' | 'None';
    actual: number | null;
    previous: number | null;
    estimate: number | null;
}
export declare function fetchGeneralNews(limit?: number): Promise<FMPArticle[]>;
/**
 * Fetch economic calendar for today
 */
export declare function fetchEconomicCalendar(): Promise<FMPCalendarEvent[]>;
//# sourceMappingURL=fmp-service.d.ts.map