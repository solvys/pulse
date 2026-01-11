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

export interface PsychScores {
  executions: number;
  emotionalControl: number;
  planAdherence: number;
  riskSizing: number;
  adaptability: number;
}

export interface PsychProfile {
  blindSpots: string[];
  goal: string | null;
  orientationComplete: boolean;
  psychScores: PsychScores;
  lastAssessmentAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalystReport {
  id: string;
  agentType: string;
  reportData: {
    title?: string;
    summary?: string;
    metrics?: Array<{ label: string; value: string }>;
  };
  confidenceScore?: number | null;
  createdAt: string;
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

  async list(params?: { limit?: number; offset?: number; symbol?: string; minMacroLevel?: number }): Promise<RiskFlowListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());
    if (params?.symbol) query.append('symbols', params.symbol); // Backend expects 'symbols' not 'symbol'
    // Allow frontend to override minMacroLevel for debugging (default is 3)
    if (params?.minMacroLevel !== undefined) {
      query.append('minMacroLevel', params.minMacroLevel.toString());
    }

    const queryString = query.toString();
    const endpoint = `/api/riskflow/feed${queryString ? `?${queryString}` : ''}`;
    try {
      const response = await this.client.get<{ items?: any[]; total?: number }>(endpoint);
      
      // Backend returns { items: FeedItem[], total: number, hasMore: boolean, fetchedAt: string }
      const items = response.items || [];
      
      console.log(`[RiskFlowService] Received ${items.length} items from backend (total: ${response.total ?? 0})`);
      if (items.length === 0) {
        console.warn(`[RiskFlowService] Empty response from backend - check database cache and filters`);
      }

      // Transform backend FeedItem to frontend RiskFlowItem format
      return {
        items: items.map((item: any) => {
          // Backend uses 'headline', frontend expects 'title'
          // Backend uses 'body', frontend expects 'content'
          // Backend uses 'ivScore', frontend expects 'ivScore' (same)
          // Backend uses 'macroLevel', frontend expects 'macroLevel' (same)
          const ivScore = item.ivScore ?? 0;
          const macroLevel = item.macroLevel ?? 1;
          
          return {
            id: item.id?.toString() || '',
            title: item.headline || item.title || '', // Map headline to title
            content: item.body || item.content || '', // Map body to content
            summary: item.body || item.content || '', // Also set summary for compatibility
            source: item.source || '',
            url: item.url,
            publishedAt: item.publishedAt || item.published_at || new Date().toISOString(),
            impact: ivScore > 7 ? 'high' : ivScore > 4 ? 'medium' : 'low',
            symbols: item.symbols || [],
            sentiment: item.sentiment || 'neutral',
            ivScore: ivScore,
            ivImpact: ivScore, // Also set ivImpact for backward compatibility
            macroLevel: macroLevel,
            isBreaking: item.isBreaking || false,
            category: item.source || '',
            tags: item.tags || [],
            urgency: item.urgency || 'normal',
          };
        }),
        total: response.total ?? items.length,
      };
    } catch (error: any) {
      console.error('[RiskFlowService] Failed to fetch RiskFlow:', error);
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

  /**
   * Send a chat message (non-streaming legacy wrapper, prefer Vercel AI SDK directly)
   */
  async chat(data: { message: string; conversationId?: string; messages?: any[] }): Promise<any> {
    try {
      // If messages array is provided (Vercel SDK format), pass it through
      const payload = data.messages ? { messages: data.messages, conversationId: data.conversationId } : { messages: [{ role: 'user', content: data.message }], conversationId: data.conversationId };

      const response = await this.client.post('/api/ai/chat', payload);
      return response;
    } catch (error: any) {
      console.error('AI chat error:', error);
      throw error;
    }
  }

  async listConversations(): Promise<any[]> {
    try {
      const response = await this.client.get<{ conversations: any[] }>('/api/ai/conversations');
      return response.conversations || [];
    } catch (error) {
      console.warn('listConversations endpoint error:', error);
      return [];
    }
  }

  async getConversation(id: string): Promise<any> {
    return this.client.get<any>(`/api/ai/conversations/${id}`);
  }

  /**
   * Quick Pulse: Analyze a chart screenshot
   */
  async quickPulse(image: string, algoState: any): Promise<any> {
    return this.client.post('/api/ai/quick-pulse', { image, algoState });
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

// Psych Assist Service
export class PsychService {
  constructor(private client: ApiClient) { }

  async getProfile(): Promise<PsychProfile> {
    const response = await this.client.get<{ profile: PsychProfile }>('/api/psych/profile');
    return response.profile;
  }

  async updateProfile(data: { blindSpots?: string[]; goal?: string | null; orientationComplete?: boolean; source?: 'orientation' | 'settings' }): Promise<PsychProfile> {
    const response = await this.client.put<{ profile: PsychProfile }>('/api/psych/profile', data);
    return response.profile;
  }

  async updateScores(scores: Partial<PsychScores>): Promise<PsychProfile> {
    const response = await this.client.post<{ profile: PsychProfile }>('/api/psych/scores', scores);
    return response.profile;
  }
}

// Analyst Service
export class AnalystService {
  constructor(private client: ApiClient) { }

  async getReports(params?: { refresh?: boolean; instrument?: string }): Promise<AnalystReport[]> {
    const query = new URLSearchParams();
    if (params?.refresh) query.append('refresh', 'true');
    if (params?.instrument) query.append('instrument', params.instrument);
    const endpoint = `/api/agents/reports${query.size ? `?${query.toString()}` : ''}`;
    const response = await this.client.get<{ reports: AnalystReport[] }>(endpoint);
    return response.reports || [];
  }

  async runReports(data?: { instrument?: string }): Promise<AnalystReport[]> {
    const response = await this.client.post<{ reports: AnalystReport[] }>('/api/agents/reports/run', data ?? {});
    return response.reports || [];
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
  psych: PsychService;
  analysts: AnalystService;
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
    psych: new PsychService(client),
    analysts: new AnalystService(client),
    trading: new TradingService(client),
    projectx: new ProjectXService(client),
    notifications: new NotificationsService(client),
    er: new ERService(client),
    events: new EventsService(client),
    polymarket: new PolymarketService(client),
  };
}
