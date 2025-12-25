import { useAuth } from "@clerk/clerk-react";

// Get API URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { getToken, isSignedIn } = useAuth();
    if (!isSignedIn) return {};

    try {
      const token = await getToken();
      return token ? { 'Authorization': `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = `${this.baseUrl}${endpoint}`;

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
      throw new Error(`API Error ${response.status}: ${error}`);
    }

    return response.json();
  }

  // Account endpoints
  async getAccount() {
    return this.request('/account');
  }

  async createAccount(data: { initialBalance: number }) {
    return this.request('/account', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccountSettings(data: any) {
    return this.request('/account/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateAccountTier(data: { tier: string }) {
    return this.request('/account/tier', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ProjectX endpoints
  async listAccounts() {
    return this.request('/projectx/accounts');
  }

  async syncProjectX(data: { username: string; apiKey: string }) {
    return this.request('/projectx/sync', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listOrders(accountId: number) {
    return this.request(`/projectx/orders?accountId=${accountId}`);
  }

  async placeOrder(data: any) {
    return this.request('/projectx/order', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getContracts(symbol: string) {
    return this.request(`/projectx/contracts/${symbol}`);
  }

  // Trading endpoints
  async recordTrade(data: any) {
    return this.request('/trading/record', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTrades(params?: { accountId?: number; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.accountId) query.set('accountId', params.accountId.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    return this.request(`/trading/history${query.toString() ? '?' + query.toString() : ''}`);
  }

  async listPositions() {
    return this.request('/trading/positions');
  }

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

// Create singleton instance
const backend = new ApiClient(API_URL);

export function useBackend() {
  return backend;
}

export default backend;
