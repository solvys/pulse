/**
 * Financial Modeling Prep (FMP) Service
 * Tertiary source for general financial news and economic calendar
 */
import { env } from '../env.js';
const BASE_URL = 'https://financialmodelingprep.com/api/v3';
export async function fetchGeneralNews(limit = 20) {
    if (!env.FMP_API_KEY) {
        console.warn('FMP_API_KEY missing, skipping FMP News');
        return [];
    }
    try {
        const response = await fetch(`${BASE_URL}/fmp/articles?page=0&size=${limit}&apikey=${env.FMP_API_KEY}`);
        if (!response.ok)
            throw new Error(`FMP API Error ${response.status}`);
        const data = await response.json();
        if (!data.content)
            return [];
        return data.content.map((item) => ({
            symbol: item.tickers || 'GENERAL',
            publishedDate: item.date,
            title: item.title,
            image: item.image,
            site: item.site,
            text: item.content, // Often HTML
            url: item.link
        }));
    }
    catch (error) {
        console.error('Failed to fetch FMP news:', error);
        return [];
    }
}
/**
 * Fetch economic calendar for today
 */
export async function fetchEconomicCalendar() {
    if (!env.FMP_API_KEY)
        return [];
    try {
        const today = new Date().toISOString().split('T')[0];
        // Fetch typically for a range, here just today
        const response = await fetch(`${BASE_URL}/economic_calendar?from=${today}&to=${today}&apikey=${env.FMP_API_KEY}`);
        if (!response.ok)
            throw new Error(`FMP API Error ${response.status}`);
        const data = await response.json();
        return data.map(item => ({
            event: item.event,
            currency: item.currency,
            date: item.date,
            country: item.country,
            impact: item.impact || 'None',
            actual: item.actual,
            previous: item.previous,
            estimate: item.estimate
        }));
    }
    catch (error) {
        console.error('Failed to fetch FMP calendar:', error);
        return [];
    }
}
//# sourceMappingURL=fmp-service%202.js.map