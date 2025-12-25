// API client for backend integration
// Now restored with real Fly.io backend integration

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type ClerkBrowser = {
  session?: {
    getToken: (options?: { template?: string }) => Promise<string | null>;
  };
  loaded?: boolean;
};

/**
 * Wait for Clerk to be fully loaded
 */
async function waitForClerk(maxWait = 5000): Promise<ClerkBrowser | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const startTime = Date.now();
  const checkInterval = 100;

  while (Date.now() - startTime < maxWait) {
    const clerk = (window as unknown as { Clerk?: ClerkBrowser }).Clerk;
    
    if (clerk) {
      // Check if session exists - if it does, Clerk is ready
      if (clerk.session) {
        return clerk;
      }
      // If Clerk exists but no session yet, keep waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  // Return whatever Clerk we have, even if session isn't ready
  return (window as unknown as { Clerk?: ClerkBrowser }).Clerk || null;
}

/**
 * Get Clerk token with proper initialization handling
 */
async function getClerkToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // First, try to get Clerk immediately (it might already be loaded)
    let clerk = (window as unknown as { Clerk?: ClerkBrowser }).Clerk;
    
    // If Clerk isn't available, wait for it (with a shorter timeout for faster failure)
    if (!clerk || !clerk.session) {
      clerk = await waitForClerk(3000);
    }
    
    if (!clerk) {
      console.warn('[API] Clerk not loaded yet');
      return null;
    }

    if (!clerk.session) {
      console.warn('[API] Clerk session not available - user may not be signed in');
      return null;
    }

    const token = await clerk.session.getToken();
    
    if (!token) {
      console.warn('[API] Failed to get Clerk token - user may not be signed in');
      return null;
    }

    return token;
  } catch (error) {
    console.error('[API] Error getting Clerk token:', error);
    return null;
  }
}

/**
 * Client-side fetch with Clerk token
 * For use in client components.
 *
 * Clerk token retrieval:
 * - In the browser, Clerk loads `window.Clerk` (Clerk JS).
 * - We request a token via `window.Clerk.session.getToken()`.
 * - We wait for Clerk to be fully initialized before making requests.
 *
 * We avoid `useAuth().getToken()` here because hooks can't be called from a
 * plain utility module.
 */
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = await getClerkToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    console.warn(`[API] Making unauthenticated request to ${url}`);
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: headers as HeadersInit,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorMessage;
    } catch {
      // Use default error message
    }
    
    // Log the full error for debugging
    console.error(`[API] ${options.method || 'GET'} ${url} failed:`, errorMessage);
    
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

// Account API
export const accountApi = {
  getAccount: async (): Promise<any> => {
    return fetchWithAuth('/account');
  },
};

// ProjectX API
export const projectXApi = {
  getAccounts: async (): Promise<any[]> => {
    return fetchWithAuth('/projectx/accounts');
  },
  
  getOrders: async (): Promise<any[]> => {
    return fetchWithAuth('/projectx/orders');
  },
};

// Notifications API
export const notificationsApi = {
  list: async (): Promise<any[]> => {
    return fetchWithAuth('/notifications');
  },
};

// AI/Conversations API
export const aiApi = {
  getConversations: async (): Promise<any[]> => {
    return fetchWithAuth('/ai/conversations');
  },
};