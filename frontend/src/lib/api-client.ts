// API client for backend integration

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

type ClerkBrowser = {
  session?: {
    getToken: (options?: { template?: string }) => Promise<string | null>;
  };
};

/**
 * Client-side fetch with Clerk token
 * For use in client components.
 *
 * Clerk token retrieval:
 * - In the browser, Clerk loads `window.Clerk` (Clerk JS).
 * - We request a token via `window.Clerk.session.getToken()`.
 *
 * We avoid `useAuth().getToken()` here because hooks can't be called from a
 * plain utility module.
 */
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let token: string | null = null;
  
  if (typeof window !== 'undefined') {
    try {
      const clerk = (window as unknown as { Clerk?: ClerkBrowser }).Clerk;
      token = (await clerk?.session?.getToken()) ?? null;
    } catch (error) {
      console.warn('Failed to get Clerk token:', error);
    }
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: headers as HeadersInit,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API error: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorMessage;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }
  
  return response.json();
}

// Journal API
export const journalApi = {
  getStats: async (startDate?: string, endDate?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return fetchWithAuth(`/journal/stats?${params.toString()}`);
  },
  
  getCalendar: async (month: string): Promise<{ days: any[] }> => {
    return fetchWithAuth(`/journal/calendar?month=${month}`);
  },
  
  getDateDetail: async (date: string): Promise<any> => {
    return fetchWithAuth(`/journal/date/${date}`);
  },
};

// ER API
export const erApi = {
  getByDate: async (date: string): Promise<any> => {
    return fetchWithAuth(`/er/date/${date}`);
  },
  
  getBlindspots: async (date: string): Promise<any> => {
    return fetchWithAuth(`/er/blindspots/${date}`);
  },
};

// Econ API
export const econApi = {
  getDay: async (date: string): Promise<any> => {
    return fetchWithAuth(`/econ/day/${date}`);
  },
  
  interpret: async (date: string, timezone: string, region: string): Promise<any> => {
    return fetchWithAuth('/econ/interpret', {
      method: 'POST',
      body: JSON.stringify({ date, timezone, region }),
    });
  },
};

// News API
export const newsApi = {
  getFeed: async (): Promise<{ items: any[] }> => {
    const data = await fetchWithAuth('/news/feed');
    // Backend returns 'articles', frontend expects 'items'
    return {
      items: (data.articles || []).map((article: any) => ({
        id: article.id?.toString() || '',
        time: article.publishedAt || new Date().toISOString(),
        source: article.source || 'Unknown',
        headline: article.title || '',
        sentiment: article.sentiment || 'neutral',
        ivImpact: article.ivImpact || 0,
        isBreaking: article.isBreaking || false,
      })),
    };
  },
};

// Market API
export const marketApi = {
  getVIX: async (): Promise<{ value: number; timestamp: string; source: string }> => {
    return fetchWithAuth('/market/vix');
  },
  
  getData: async (symbol: string): Promise<any> => {
    return fetchWithAuth(`/market/data/${symbol}`);
  },
  
  getBars: async (symbol: string, unit?: string, barsBack?: number): Promise<any> => {
    const params = new URLSearchParams();
    if (unit) params.append('unit', unit);
    if (barsBack) params.append('barsBack', barsBack.toString());
    return fetchWithAuth(`/market/bars/${symbol}?${params.toString()}`);
  },
};

// IV Scoring API
export const ivScoringApi = {
  calculate: async (symbol: string): Promise<{
    symbol: string;
    vixValue: number;
    ivScore: number;
    impliedPoints: { daily: number; session: number };
    riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    timestamp: string;
  }> => {
    return fetchWithAuth(`/iv-scoring/calculate?symbol=${symbol}`);
  },
};
