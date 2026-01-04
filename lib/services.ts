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
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  source: string;
  url?: string;
  publishedAt: Date;
  impact?: 'high' | 'medium' | 'low';
  symbols?: string[];
}

export interface NewsListResponse {
  items: NewsItem[];
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
    reportType?: string;
    generatedAt?: string;
  };
  metadata?: Record<string, unknown> | null;
  model?: string | null;
}

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  side: 'long' | 'short';
}

export interface PositionsResponse {
  positions: Position[];
}

export interface ProjectXAccount {
  accountId: string;
  accountName: string;
  balance?: number;
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
    return this.client.get<Account>('/api/account');
  }

  async create(data: { initialBalance?: number }): Promise<Account> {
    return this.client.post<Account>('/api/account', data);
  }

  async updateSettings(data: Partial<Account>): Promise<Account> {
    return this.client.patch<Account>('/api/account/settings', data);
  }

  async updateTier(data: { tier: Account['tier'] }): Promise<Account> {
    return this.client.patch<Account>('/api/account/tier', data);
  }
}

// News Service
export class NewsService {
  constructor(private client: ApiClient) { }

  async list(params?: { limit?: number; offset?: number }): Promise<NewsListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    const queryString = query.toString();
    const endpoint = `/api/news${queryString ? `?${queryString}` : ''}`;
    return this.client.get<NewsListResponse>(endpoint);
  }

  async seed(): Promise<void> {
    return this.client.post('/api/news/seed');
  }

  async fetchVIX(): Promise<{ value: number }> {
    return this.client.get<{ value: number }>('/api/market/vix');
  }
}

// AI Service
export class AIService {
  constructor(private client: ApiClient) { }

  async chat(data: { message: string; conversationId?: string }): Promise<ChatResponse> {
    return this.client.post<ChatResponse>('/api/ai/chat', data);
  }

  async generateNTNReport(): Promise<NTNReport> {
    return this.client.post<NTNReport>('/api/ai/ntn-report');
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
    return this.client.get<PositionsResponse>('/api/trading/positions');
  }

  async seedPositions(): Promise<void> {
    return this.client.post('/api/trading/positions/seed');
  }
}

// ProjectX Service
export class ProjectXService {
  constructor(private client: ApiClient) { }

  async listAccounts(): Promise<ProjectXAccountsResponse> {
    return this.client.get<ProjectXAccountsResponse>('/api/projectx/accounts');
  }

  async uplinkProjectX(): Promise<UplinkResponse> {
    return this.client.post<UplinkResponse>('/api/projectx/uplink');
  }

  async syncProjectXAccounts(): Promise<void> {
    return this.client.post('/api/projectx/sync');
  }
}

// Notifications Service
export class NotificationsService {
  constructor(private client: ApiClient) { }

  async list(): Promise<any[]> {
    return this.client.get<any[]>('/api/notifications');
  }

  async markRead(notificationId: string): Promise<void> {
    return this.client.post(`/api/notifications/${notificationId}/read`);
  }
}

// ER Service (Emotional Resonance)
export class ERService {
  constructor(private client: ApiClient) { }

  async getSessions(): Promise<any[]> {
    return this.client.get<any[]>('/api/er/sessions');
  }

  async saveSession(data: any): Promise<any> {
    return this.client.post('/api/er/sessions', data);
  }
}

// Events Service
export class EventsService {
  constructor(private client: ApiClient) { }

  async list(): Promise<any[]> {
    return this.client.get<any[]>('/api/events');
  }
}


// Twitter Service
export class TwitterService {
  constructor(private client: ApiClient) { }

  async getMarketSentiment(symbols?: string[], hoursBack?: number): Promise<any> {
    const params = new URLSearchParams();
    if (symbols) params.append('symbols', symbols.join(','));
    if (hoursBack) params.append('hoursBack', hoursBack.toString());

    const queryString = params.toString();
    const endpoint = `/api/twitter/sentiment${queryString ? `?${queryString}` : ''}`;
    return this.client.get(endpoint);
  }

  async searchTweets(query: string, limit?: number): Promise<any> {
    const params = new URLSearchParams();
    params.append('query', query);
    if (limit) params.append('limit', limit.toString());

    return this.client.get(`/api/twitter/search?${params.toString()}`);
  }

  async getInfluentialTweets(accounts?: string[], limit?: number): Promise<any> {
    const params = new URLSearchParams();
    if (accounts) params.append('accounts', accounts.join(','));
    if (limit) params.append('limit', limit.toString());

    const queryString = params.toString();
    const endpoint = `/api/twitter/influential${queryString ? `?${queryString}` : ''}`;
    return this.client.get(endpoint);
  }
}

// Main Backend Client Interface
export interface BackendClient {
  account: AccountService;
  news: NewsService;
  ai: AIService;
  psych: PsychService;
  analysts: AnalystService;
  trading: TradingService;
  projectx: ProjectXService;
  notifications: NotificationsService;
  er: ERService;
  events: EventsService;
}

// Create backend client from API client
export function createBackendClient(client: ApiClient): BackendClient {
  return {
    account: new AccountService(client),
    news: new NewsService(client),
    ai: new AIService(client),
    psych: new PsychService(client),
    analysts: new AnalystService(client),
    trading: new TradingService(client),
    projectx: new ProjectXService(client),
    notifications: new NotificationsService(client),
    er: new ERService(client),
    events: new EventsService(client),
  };
}
