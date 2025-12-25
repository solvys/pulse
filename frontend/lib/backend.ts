import { useAuth } from "@clerk/clerk-react";
import { useMemo } from "react";
import type {
  Account,
  BrokerAccount,
  Trade,
  Position,
  ERSession,
  OvertradingStatus,
  NewsItem,
  SystemEvent,
  Notification
} from "./api-types";

// Define Order and Contract types locally since they're not in api-types yet
interface Order {
  id: number;
  accountId: number;
  contractId?: string;
  symbol: string;
  side: string;
  orderType: string;
  size: number;
  limitPrice?: number;
  stopPrice?: number;
  status: string;
  filledSize: number;
  avgFillPrice?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Contract {
  id: number;
  name: string;
  symbol: string;
  description: string;
  tickSize: number;
  tickValue: number;
  active: boolean;
}

// Get API URL from environment
// Default to localhost:8080 for local dev (matches backend-hono default port)
// Production should set VITE_API_URL to Fly.io URL: https://pulse-api-withered-dust-1394.fly.dev
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

class ApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(baseUrl: string, getAuthToken?: () => Promise<string | null>) {
    this.baseUrl = baseUrl;
    this.getAuthToken = getAuthToken;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.getAuthToken) return {};
    
    try {
      const token = await this.getAuthToken();
      return token ? { 'Authorization': `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        const errorMessage = `API Error ${response.status}: ${error}`;
        console.error(`[API] ${options.method || 'GET'} ${endpoint} failed:`, errorMessage);
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      // Log network errors for debugging
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`[API] Network error connecting to ${url}:`, error);
        throw new Error(`Failed to connect to backend at ${this.baseUrl}. Is the server running?`);
      }
      throw error;
    }
  }

  // Namespaced services to match component expectations
  readonly account = {
    get: () => this.request<Account>('/account'),
    create: (data: { initialBalance: number }) => this.request<Account>('/account', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    updateSettings: (data: any) => this.request('/account/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    updateTier: (data: { tier: string }) => this.request('/account/tier', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    updateProjectXCredentials: (data: { username: string; apiKey: string }) => this.request('/projectx/sync', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  };

  readonly projectx = {
    listAccounts: (): Promise<{ accounts: BrokerAccount[] }> => this.request<{ accounts: BrokerAccount[] }>('/projectx/accounts'),
    syncProjectXAccounts: (data: { username: string; apiKey: string }): Promise<{ success: boolean; message: string }> => this.request('/projectx/sync', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    listOrders: (accountId: number): Promise<{ orders: Order[] }> => this.request(`/projectx/orders?accountId=${accountId}`),
    placeOrder: (data: any): Promise<{ orderId: number; status: string; message: string }> => this.request('/projectx/order', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getContracts: (symbol: string): Promise<{ contracts: Contract[] }> => this.request(`/projectx/contracts/${symbol}`),
    uplinkProjectX: (): Promise<{ success: boolean; message: string }> => this.request('/projectx/uplink', {
      method: 'POST',
    }),
  };

  readonly trading = {
    recordTrade: (data: any): Promise<{ success: boolean; tradeId: number; message: string }> => this.request('/trading/record', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getTrades: (params?: { accountId?: number; limit?: number; offset?: number }): Promise<{ trades: Trade[]; total: number }> => {
      const query = new URLSearchParams();
      if (params?.accountId) query.set('accountId', params.accountId.toString());
      if (params?.limit) query.set('limit', params.limit.toString());
      if (params?.offset) query.set('offset', params.offset.toString());

      return this.request<{ trades: Trade[]; total: number }>(`/trading/history${query.toString() ? '?' + query.toString() : ''}`);
    },
    listPositions: (): Promise<{ positions: Position[] }> => this.request<{ positions: Position[] }>('/trading/positions'),
    executeSignal: (data: any): Promise<{ success: boolean; message: string }> => this.request('/trading/execute', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    fireTestTrade: (data: any): Promise<{ success: boolean; message: string }> => this.request('/trading/test-trade', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getSignals: (): Promise<{ signals: any[] }> => this.request('/trading/signals'),
    toggleAlgo: (data: any): Promise<{ success: boolean; message: string }> => this.request('/trading/algo/toggle', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    seedPositions: (): Promise<{ success: boolean }> => this.request('/trading/seed', {
      method: 'POST',
    }),
  };

  readonly ai = {
    chat: (data: any): Promise<{ message: string; conversationId?: string }> => this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    checkTape: (): Promise<{ message: string; insights: any[] }> => this.request('/ai/check-tape', {
      method: 'POST',
    }),
    generateDailyRecap: (): Promise<{ message: string; recap: string }> => this.request('/ai/daily-recap', {
      method: 'POST',
    }),
    generateNTNReport: (): Promise<{ message: string; report: string }> => this.request('/ai/ntn-report', {
      method: 'POST',
    }),
    listConversations: (): Promise<{ conversations: any[] }> => this.request('/ai/conversations'),
    getConversation: (data: { conversationId: string }): Promise<{ messages: any[] }> => {
      return this.request(`/ai/conversation?conversationId=${data.conversationId}`);
    },
  };

  readonly er = {
    saveSession: (data: any): Promise<{ success: boolean; sessionId: number }> => this.request('/er/save-session', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getERSessions: (): Promise<{ sessions: ERSession[] }> => this.request<{ sessions: ERSession[] }>('/er/sessions'),
    saveSnapshot: (data: any): Promise<{ success: boolean }> => this.request('/er/snapshot', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    checkOvertrading: (params?: { windowMinutes?: number; threshold?: number }): Promise<OvertradingStatus> => {
      const query = new URLSearchParams();
      if (params?.windowMinutes) query.set('windowMinutes', params.windowMinutes.toString());
      if (params?.threshold) query.set('threshold', params.threshold.toString());

      return this.request<OvertradingStatus>(`/er/overtrading${query.toString() ? '?' + query.toString() : ''}`);
    },
  };

  readonly news = {
    list: (params?: { limit?: number }) => {
      const query = params?.limit ? `?limit=${params.limit}` : '';
      return this.request<{ news: NewsItem[] }>(`/news${query}`);
    },
    sync: () => this.request('/news/sync', {
      method: 'POST',
    }),
  };

  readonly notifications = {
    getPreferences: () => this.request('/notifications/preferences'),
    list: () => this.request<{ notifications: Notification[] }>('/notifications'),
    markRead: (notificationId: number) => this.request(`/notifications/${notificationId}/read`, {
      method: 'POST',
    }),
    send: (data: any) => this.request('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    updatePreferences: (data: any) => this.request('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  };

  readonly events = {
    create: (data: any) => this.request('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    list: (params?: { limit?: number }) => {
      const query = params?.limit ? `?limit=${params.limit}` : '';
      return this.request<{ events: SystemEvent[] }>(`/events${query}`);
    },
    seed: () => this.request('/events/seed', {
      method: 'POST',
    }),
  };


  // ER (Emotional Resonance) endpoints
  async saveERSession(data: any) {
    return this.request('/er/save-session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getERSessions() {
    return this.request('/er/sessions');
  }

  async saveERSnapshot(data: any) {
    return this.request('/er/snapshot', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async checkOvertrading(params?: { windowMinutes?: number; threshold?: number }) {
    const query = new URLSearchParams();
    if (params?.windowMinutes) query.set('windowMinutes', params.windowMinutes.toString());
    if (params?.threshold) query.set('threshold', params.threshold.toString());

    return this.request(`/er/overtrading${query.toString() ? '?' + query.toString() : ''}`);
  }

  // News endpoints
  async listNews(params?: { limit?: number }) {
    const query = params?.limit ? `?limit=${params.limit}` : '';
    return this.request(`/news${query}`);
  }

  async syncNews() {
    return this.request('/news/sync', {
      method: 'POST',
    });
  }

  // Notifications endpoints
  async getNotificationPreferences() {
    return this.request('/notifications/preferences');
  }

  async listNotifications() {
    return this.request('/notifications');
  }

  async markNotificationRead(notificationId: number) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  }

  async sendNotification(data: any) {
    return this.request('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNotificationPreferences(data: any) {
    return this.request('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

// Create base singleton instance (for use outside React components)
const backend = new ApiClient(API_URL);

export function useBackend() {
  const { getToken, isSignedIn } = useAuth();
  
  // Memoize the client instance with auth token getter
  return useMemo(() => {
    const getAuthToken = async (): Promise<string | null> => {
      if (!isSignedIn) return null;
      try {
        return await getToken();
      } catch {
        return null;
      }
    };
    
    return new ApiClient(API_URL, getAuthToken);
  }, [getToken, isSignedIn]);
}

export default backend;
