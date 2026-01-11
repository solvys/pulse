/**
 * Market Service
 * Business logic for market data operations
 */

export interface VixData {
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  timestamp: string;
  source: 'fmp' | 'mock';
}

export interface QuoteData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: 'fmp' | 'mock';
}

// Cache for VIX data (1 minute TTL)
let vixCache: { data: VixData; expiresAt: number } | null = null;
const VIX_CACHE_TTL_MS = 60_000;

// FMP API configuration
const FMP_API_KEY = process.env.FMP_API_KEY;
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

/**
 * Fetch VIX data from FMP API
 */
async function fetchVixFromFmp(): Promise<VixData | null> {
  if (!FMP_API_KEY) {
    console.warn('[Market] FMP_API_KEY not set, using mock data');
    return null;
  }

  try {
    const url = `${FMP_BASE_URL}/quote/%5EVIX?apikey=${FMP_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('[Market] FMP API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.error('[Market] Invalid FMP response format');
      return null;
    }

    const quote = data[0];
    return {
      symbol: 'VIX',
      value: quote.price ?? quote.previousClose ?? 0,
      change: quote.change ?? 0,
      changePercent: quote.changesPercentage ?? 0,
      timestamp: new Date().toISOString(),
      source: 'fmp',
    };
  } catch (error) {
    console.error('[Market] FMP fetch failed:', error);
    return null;
  }
}

/**
 * Generate mock VIX data for development
 */
function generateMockVix(): VixData {
  // Base VIX around 16-22 range (typical market)
  const baseValue = 18 + (Math.random() * 4 - 2);
  const change = (Math.random() * 2 - 1);
  const changePercent = (change / baseValue) * 100;

  return {
    symbol: 'VIX',
    value: Math.round(baseValue * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    timestamp: new Date().toISOString(),
    source: 'mock',
  };
}

/**
 * Get current VIX value
 * Uses FMP API with fallback to mock data
 */
export async function getVix(): Promise<VixData> {
  // Check cache first
  if (vixCache && Date.now() < vixCache.expiresAt) {
    return vixCache.data;
  }

  // Try to fetch from FMP
  const fmpData = await fetchVixFromFmp();

  if (fmpData) {
    vixCache = {
      data: fmpData,
      expiresAt: Date.now() + VIX_CACHE_TTL_MS,
    };
    return fmpData;
  }

  // Fallback to mock data
  const mockData = generateMockVix();
  vixCache = {
    data: mockData,
    expiresAt: Date.now() + VIX_CACHE_TTL_MS,
  };
  return mockData;
}

/**
 * Get quote for a symbol (placeholder implementation)
 * Will be expanded in future phases
 */
export async function getQuote(symbol: string): Promise<QuoteData> {
  // For now, return mock data
  // TODO: Integrate with FMP API for real quotes
  const basePrice = 100 + Math.random() * 50;
  const change = (Math.random() * 4 - 2);
  const changePercent = (change / basePrice) * 100;

  return {
    symbol,
    price: Math.round(basePrice * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume: Math.floor(Math.random() * 1_000_000),
    timestamp: new Date().toISOString(),
    source: 'mock',
  };
}
