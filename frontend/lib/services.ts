/**
 * API Service Wrappers for Hono Backend
 * 
 * These services provide a compatible interface to replace the Encore client.
 * Update the endpoint paths to match your Hono backend routes.
 */

import ApiClient from "./apiClient";

// Type definitions (update these to match your Hono backend response types)
export interface Account {
  id: string;
  userId: string;
  balance: number;
  dailyPnl: number;
  dailyTarget?: number;
  dailyLossLimit?: number;
  tier?: 'free' | 'pulse' | 'pulse_plus' | 'pulse_pro';
  tradingEnabled?: boolean;
  autoTrade?: boolean;
  riskManagement?: boolean;
  algoEnabled?: boolean;
  topstepxUsername?: string;
  topstepxApiKey?: string;
  selectedSymbol?: string;
  contractsPerTrade?: number;
  projectxUsername?: string;
}

import type { RiskFlowItem } from '../types/api';

export interface RiskFlowListResponse {
  items: RiskFlowItem[];
  total?: number;
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  tiltWarning?: {
    detected: boolean;
    message?: string;
  };
}

export interface NTNReport {
  report: {
    content: string;
  };
}

export interface Position {
  id: string | number;
  accountId?: number;
  contractId?: string;
  symbol?: string;
  quantity?: number;
  size?: number;
  entryPrice?: number;
  exitPrice?: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercentage?: number;
  side: string;
  openedAt: Date | string;
  closedAt?: Date | string | null;
  status?: string;
}

export interface PositionsResponse {
  positions: Position[];
}

export interface ProjectXAccount {
  accountId: string;
  accountName: string;
  balance?: number;
  provider?: string;
  isPaper?: boolean;
}

export interface ProjectXAccountsResponse {
  accounts: ProjectXAccount[];
}

export interface UplinkResponse {
  success: boolean;
  message: string;
}

// Account Service
export class AccountService {
  constructor(private client: ApiClient) { }

  async get(): Promise<Account> {
    const response = await this.client.get<any>('/api/account');
    // Get tier separately since it's not in the account response
    let tier: Account['tier'] = 'free';
    try {
      const tierResponse = await this.client.get<{ tier: Account['tier'] | null; requiresSelection: boolean }>('/api/account/tier');
      tier = tierResponse.tier || 'free';
    } catch (error) {
      // If tier endpoint fails, default to free
      console.warn('Failed to get tier, defaulting to free:', error);
    }

    // Transform backend response to match frontend expectations
    return {
      id: response.id?.toString() || '',
      userId: '', // Backend doesn't return userId
      balance: response.balance || 0,
      dailyPnl: 0, // Backend doesn't return this
      tier: tier,
      tradingEnabled: false,
      autoTrade: false,
      riskManagement: false,
      algoEnabled: false, // Backend doesn't return this
    };
  }

  async create(data: { initialBalance?: number }): Promise<Account> {
    const response = await this.client.post<any>('/api/account', data);
    // Get tier separately since it's not in the account response
    let tier: Account['tier'] = 'free';
    try {
      const tierResponse = await this.client.get<{ tier: Account['tier'] | null; requiresSelection: boolean }>('/api/account/tier');
      tier = tierResponse.tier || 'free';
    } catch (error) {
      // If tier endpoint fails, default to free
      console.warn('Failed to get tier, defaulting to free:', error);
    }

    // Transform backend response to match frontend expectations
    return {
      id: response.id?.toString() || '',
      userId: '', // Backend doesn't return userId
      balance: response.balance || 0,
      dailyPnl: 0, // Backend doesn't return this
      tier: tier,
      tradingEnabled: false,
      autoTrade: false,
      riskManagement: false,
      algoEnabled: false, // Backend doesn't return this
    };
  }

  async updateSettings(data: Partial<Account>): Promise<Account> {
    await this.client.patch('/api/account/settings', data);
    return this.get();
  }

  async updateTier(data: { tier: Account['tier'] }): Promise<Account> {
    await this.client.patch('/api/account/tier', data);
    return this.get();
  }

  async selectTier(data: { tier: Account['tier'] }): Promise<void> {
    await this.client.post('/api/account/select-tier', data);
  }

  async getTier(): Promise<{ tier: Account['tier'] | null; requiresSelection: boolean }> {
    return this.client.get('/api/account/tier');
  }

  async getFeatures(): Promise<{ tier: Account['tier']; features: Array<{ name: string; requiredTier: string; hasAccess: boolean }> }> {
    return this.client.get('/api/account/features');
  }

  async updateProjectXCredentials(data: { username?: string; apiKey?: string }): Promise<void> {
    // Use projectx sync endpoint
    if (data.username && data.apiKey) {
      await this.client.post('/api/projectx/sync', data);
    }
  }
}

// RiskFlow Service
export class RiskFlowService {
  constructor(private client: ApiClient) { }

  async list(params?: { limit?: number; offset?: number }): Promise<RiskFlowListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    const queryString = query.toString();
    const endpoint = `/api/riskflow/feed${queryString ? `?${queryString}` : ''}`;
    try {
      const response = await this.client.get<{ articles?: any[] }>(endpoint);
      // Handle both response formats: { articles: [...] } or { items: [...] }
      const articles = response.articles || (response as any).items || [];

      // Transform backend response to match frontend expectations
      return {
        items: (Array.isArray(articles) ? articles : []).map(article => ({
          id: article.id?.toString() || '',
          title: article.title || '',
          content: article.summary || article.content || '',
          source: article.source || '',
          url: article.url,
          publishedAt: article.publishedAt || article.published_at || new Date(),
          impact: article.ivImpact || article.iv_impact
            ? (article.ivImpact || article.iv_impact) > 7 ? 'high'
              : (article.ivImpact || article.iv_impact) > 4 ? 'medium'
                : 'low'
            : undefined,
          symbols: article.symbols || [],
          sentiment: article.sentiment,
          ivScore: article.ivImpact || article.iv_impact || 0,
          category: article.category || article.source || '',
        })),
        total: Array.isArray(articles) ? articles.length : 0,
      };
    } catch (error: any) {
      console.error('Failed to fetch RiskFlow:', error);
      // Return empty response on error
      return {
        items: [],
        total: 0,
      };
    }
  }

  async seed(): Promise<void> {
    try {
      await this.client.post('/api/riskflow/seed', {});
    } catch (error) {
      console.error('Failed to seed RiskFlow:', error);
      throw error;
    }
  }

  async fetchVIX(): Promise<{ value: number }> {
    return this.client.get<{ value: number }>('/api/market/vix');
  }
}

// AI Service
export class AIService {
  constructor(private client: ApiClient) { }

  async chat(data: { message: string; conversationId?: string }): Promise<ChatResponse> {
    try {
      const response = await this.client.post<ChatResponse>('/api/ai/chat', {
        message: data.message,
        conversationId: data.conversationId,
      });

      return response;
    } catch (error: any) {
      console.error('AI chat error:', error);
      throw error;
    }
  }

  async listConversations(): Promise<any[]> {
    return this.client.get<{ conversations: any[] }>('/api/ai/conversations').then(r => r.conversations || []);
  }

  async getConversation(id: string): Promise<any> {
    const response = await this.client.get<any>(`/api/ai/conversations/${id}`);
    return response;
  }

  async checkTape(): Promise<any> {
    const response = await this.client.post<any>('/api/ai/check-tape', {});
    return response;
  }

  async generateDailyRecap(): Promise<any> {
    const response = await this.client.post<any>('/api/ai/generate-daily-recap', {});
    return response;
  }

  async generateNTNReport(): Promise<NTNReport> {
    // Stub - backend doesn't have this endpoint yet
    console.warn('NTN report endpoint not available in Hono backend');
    return {
      report: {
        content: 'NTN report generation is not yet implemented in the Hono backend.',
      },
    };
  }
}

// Trading Service
export class TradingService {
  constructor(private client: ApiClient) { }

  async listPositions(): Promise<PositionsResponse> {
    const response = await this.client.get<{ positions: any[] }>('/api/trading/positions');
    // Transform backend response to match frontend expectations
    return {
      positions: response.positions.map(pos => ({
        id: pos.id?.toString() || '',
        symbol: pos.symbol || '',
        quantity: pos.size || 0,
        size: pos.size || 0,
        entryPrice: pos.entryPrice || 0,
        currentPrice: pos.entryPrice || 0, // Backend doesn't return current price
        pnl: pos.pnl || 0,
        pnlPercentage: pos.pnlPercentage || 0,
        side: pos.side || '',
        openedAt: pos.openedAt || new Date().toISOString(),
        status: 'open',
      })),
    };
  }

  async seedPositions(): Promise<void> {
    // Stub - backend doesn't have this endpoint
    console.warn('Position seed endpoint not available in Hono backend');
  }

  async toggleAlgo(data: any): Promise<any> {
    const response = await this.client.post<any>('/api/trading/toggle-algo', data);
    return response;
  }

  async fireTestTrade(data: any): Promise<any> {
    const response = await this.client.post<any>('/api/trading/test-trade', data);
    return response;
  }
}

// ProjectX Service
export class ProjectXService {
  constructor(private client: ApiClient) { }

  async listAccounts(): Promise<ProjectXAccountsResponse> {
    const response = await this.client.get<{ accounts: any[] }>('/api/projectx/accounts');
    // Transform backend response to match frontend expectations
    return {
      accounts: response.accounts.map(acc => ({
        accountId: acc.accountId?.toString() || acc.id?.toString() || '',
        accountName: acc.accountName || '',
        balance: acc.balance,
        provider: acc.provider || 'projectx',
        isPaper: acc.isPaper || false,
      })),
    };
  }

  async uplinkProjectX(): Promise<UplinkResponse> {
    // Stub - backend doesn't have this endpoint
    console.warn('ProjectX uplink endpoint not available in Hono backend');
    return {
      success: false,
      message: 'Uplink endpoint not available',
    };
  }

  async syncProjectXAccounts(): Promise<void> {
    return this.client.post('/api/projectx/sync', {});
  }
}

// Notifications Service
export class NotificationsService {
  constructor(private client: ApiClient) { }

  async list(): Promise<any[]> {
    const response = await this.client.get<{ notifications: any[] }>('/api/notifications');
    return response.notifications || [];
  }

  async markRead(notificationId: string): Promise<void> {
    // Stub - backend doesn't have this endpoint
    console.warn('Notification mark read endpoint not available in Hono backend');
  }
}

// ER Service (Emotional Resonance)
export class ERService {
  constructor(private client: ApiClient) { }

  async getSessions(): Promise<any[]> {
    // Backend uses /er/date/:date pattern instead of /er/sessions
    // Return empty array for now - frontend should use date-specific endpoints
    console.warn('ER sessions endpoint not available. Use /er/date/:date instead.');
    return [];
  }

  async getERSessions(): Promise<any[]> {
    // Alias for getSessions
    return this.getSessions();
  }

  async saveSession(data: any): Promise<any> {
    return this.client.post('/api/er/sessions', data);
  }

  async saveSnapshot(data: any): Promise<any> {
    // Stub - backend doesn't have this endpoint
    console.warn('ER snapshot save endpoint not available in Hono backend');
    return {};
  }

  async checkOvertrading(params?: { windowMinutes?: number; threshold?: number }): Promise<any> {
    // Stub - backend doesn't have this endpoint
    console.warn('ER overtrading check endpoint not available in Hono backend');
    return { isOvertrading: false, tradesInWindow: 0 };
  }
}

// Events Service
export class EventsService {
  constructor(private client: ApiClient) { }

  async list(): Promise<any[]> {
    // Stub - backend doesn't have this endpoint
    console.warn('Events endpoint not available in Hono backend');
    return [];
  }

  async seed(): Promise<void> {
    // Stub - backend doesn't have this endpoint
    console.warn('Events seed endpoint not available in Hono backend');
  }
}

// Polymarket Service
export class PolymarketService {
  constructor(private client: ApiClient) { }

  async getOdds(): Promise<{ success: boolean; data: { odds: any[] } }> {
    return this.client.get('/api/polymarket/odds');
  }

  async getUpdates(limit?: number, marketType?: string): Promise<{ success: boolean; data: { updates: any[] } }> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (marketType) params.append('marketType', marketType);

    const queryString = params.toString();
    const endpoint = `/api/polymarket/updates${queryString ? `?${queryString}` : ''}`;
    return this.client.get(endpoint);
  }

  async sync(): Promise<{ success: boolean; message: string; oddsCount?: number }> {
    return this.client.post('/api/polymarket/sync');
  }
}

// Main Backend Client Interface
export interface BackendClient {
  account: AccountService;
  riskflow: RiskFlowService;
  ai: AIService;
  trading: TradingService;
  projectx: ProjectXService;
  notifications: NotificationsService;
  er: ERService;
  events: EventsService;
  polymarket: PolymarketService;
}

// Create backend client from API client
export function createBackendClient(client: ApiClient): BackendClient {
  return {
    account: new AccountService(client),
    riskflow: new RiskFlowService(client),
    ai: new AIService(client),
    trading: new TradingService(client),
    projectx: new ProjectXService(client),
    notifications: new NotificationsService(client),
    er: new ERService(client),
    events: new EventsService(client),
    polymarket: new PolymarketService(client),
  };
}
