// API client for backend integration

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // In production, get token from Clerk
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  
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
    throw new Error(`API error: ${response.statusText}`);
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
  getFeed: async (): Promise<any> => {
    return fetchWithAuth('/news/feed');
  },
};
