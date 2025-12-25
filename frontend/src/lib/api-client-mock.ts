// Mock API client for frontend without backend dependencies
// Returns placeholder/empty data to maintain UI structure

// Journal API - Mock implementation
export const journalApi = {
  getStats: async (startDate?: string, endDate?: string): Promise<any> => {
    // Return empty stats
    return {
      totalPnL: 0,
      winRate: 0,
      totalTrades: 0,
      avgWin: 0,
      avgLoss: 0,
    };
  },
  
  getCalendar: async (month: string): Promise<{ days: any[] }> => {
    // Return empty calendar
    return { days: [] };
  },
  
  getDateDetail: async (date: string): Promise<any> => {
    // Return empty date detail
    return {
      date,
      pnl: 0,
      orders: [],
      pnlByTime: [],
    };
  },
};

// ER API - Mock implementation
export const erApi = {
  getByDate: async (date: string): Promise<any> => {
    // Return empty ER data
    return {
      date,
      scores: [],
    };
  },
  
  getBlindspots: async (date: string): Promise<any> => {
    // Return empty blindspot data
    return {
      date,
      rating: 0,
      summary: '',
    };
  },
};

// Econ API - Mock implementation
export const econApi = {
  getDay: async (date: string): Promise<any> => {
    // Return empty econ plan
    return {
      date,
      plan: null,
      events: [],
    };
  },
  
  interpret: async (date: string, timezone: string, region: string): Promise<any> => {
    // Return empty interpretation
    return {
      date,
      plan: null,
      events: [],
    };
  },
};

// News API - Mock implementation
export const newsApi = {
  getFeed: async (): Promise<{ items: any[] }> => {
    // Return empty news feed
    return { items: [] };
  },
};

// Market API - Mock implementation
export const marketApi = {
  getVIX: async (): Promise<{ value: number; timestamp: string; source: string }> => {
    // Return placeholder VIX
    return {
      value: 0,
      timestamp: new Date().toISOString(),
      source: 'mock',
    };
  },
  
  getData: async (symbol: string): Promise<any> => {
    // Return empty market data
    return {
      symbol,
      price: 0,
      change: 0,
    };
  },
  
  getBars: async (symbol: string, unit?: string, barsBack?: number): Promise<any> => {
    // Return empty bars
    return {
      symbol,
      bars: [],
    };
  },
};

// IV Scoring API - Mock implementation
export const ivScoringApi = {
  calculate: async (symbol: string): Promise<{
    symbol: string;
    vixValue: number;
    ivScore: number;
    impliedPoints: { daily: number; session: number };
    riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    timestamp: string;
  }> => {
    // Return placeholder IV score
    return {
      symbol,
      vixValue: 0,
      ivScore: 5.0,
      impliedPoints: { daily: 0, session: 0 },
      riskLevel: 'medium' as const,
      timestamp: new Date().toISOString(),
    };
  },
};
