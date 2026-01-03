/**
 * AI Integration & Chat System TypeScript Types
 */
export interface IVScore {
    id?: number;
    userId?: string;
    symbol?: string;
    score: number;
    level: 'low' | 'medium' | 'high' | 'good';
    vix?: number;
    impliedPoints?: number;
    color?: 'gray' | 'green' | 'orange' | 'red';
    confidence?: number;
    factors?: string[];
    recommendation?: string;
    instrument?: string;
    timestamp: string;
}
export interface IVScoreResponse {
    score: number;
    level: 'low' | 'medium' | 'high' | 'good';
    timestamp: string;
    vix?: number;
    instrument?: string;
    color?: string;
}
export interface IVScoreHistoryResponse {
    scores: IVScore[];
    total: number;
}
export interface Conversation {
    id: number;
    userId: string;
    title?: string;
    createdAt: string;
    updatedAt: string;
}
export interface Message {
    id: number;
    conversationId: number;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
}
export interface ConversationResponse {
    conversationId: string;
    title?: string;
    updatedAt: string;
    createdAt: string;
}
export interface ConversationsResponse {
    conversations: ConversationResponse[];
    total: number;
}
export interface ChatRequest {
    message: string;
    conversationId?: string;
    model?: 'grok-4' | 'claude-opus-4' | 'claude-sonnet-4.5';
}
export interface ChatResponse {
    message: string;
    conversationId: string;
    messageId?: string;
    references?: string[];
    tiltWarning?: TiltWarning;
}
export interface TiltWarning {
    detected: boolean;
    message?: string;
    severity?: 'low' | 'medium' | 'high';
}
export interface Threat {
    id: string;
    type: 'overtrading' | 'emotional' | 'consecutive_losses';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    timestamp: string;
    metadata: ThreatMetadata;
}
export interface ThreatMetadata {
    tradeCount?: number;
    usualCount?: number;
    dailyPnL?: number;
    consecutiveLosses?: number;
    consecutiveLosingDays?: number;
    blindSpotsTriggered?: string[];
    timestamp?: string;
}
export interface ThreatHistoryResponse {
    threats: Threat[];
    analysis?: ThreatAnalysis;
}
export interface ThreatAnalysis {
    summary: string;
    patterns: string[];
    recommendations: string[];
}
export interface ThreatAnalysisRequest {
    timeRange?: 'day' | 'week' | 'month';
    includeAnalysis?: boolean;
}
export interface BlindSpot {
    id: string;
    name: string;
    isGuardRailed: boolean;
    isActive: boolean;
    category: 'behavioral' | 'risk' | 'execution' | 'custom';
    source: 'ai' | 'user';
    createdAt: string;
    updatedAt?: string;
}
export interface BlindSpotsResponse {
    blindSpots: BlindSpot[];
    columns: {
        column1: BlindSpot[];
        column2: BlindSpot[];
        column3: BlindSpot[];
    };
}
export interface BlindSpotRequest {
    name: string;
    category?: 'behavioral' | 'risk' | 'execution' | 'custom';
    isActive?: boolean;
}
export interface QuickPulseRequest {
    screenshot?: File | Buffer;
    includeScreenshot?: boolean;
}
export interface QuickPulseResponse {
    analysis: string;
    ivScore?: number;
    vix?: number;
    recommendations?: string[];
    timestamp: string;
    cached?: boolean;
}
export interface ScheduledEvent {
    id: string;
    title: string;
    scheduledTime: string;
    source: string;
    impact: 'low' | 'medium' | 'high';
    symbols?: string[];
    isCommentary?: boolean;
    eventType?: string;
}
export interface ScheduledEventsResponse {
    events: ScheduledEvent[];
}
export interface BreakingNewsEvent {
    id: string;
    title: string;
    publishedAt: string;
    impact: 'low' | 'medium' | 'high';
    symbols?: string[];
}
export interface BreakingNewsResponse {
    hasBreakingNews: boolean;
    events: BreakingNewsEvent[];
    pausedUntil?: string;
}
export interface UserSettings {
    userId: string;
    usualTradesPerDuration?: number;
    durationWindow?: string;
    selectedInstrument?: string;
    [key: string]: any;
}
export interface UserSettingsResponse {
    usualTradesPerDuration?: number;
    durationWindow?: string;
    selectedInstrument?: string;
    [key: string]: any;
}
export interface ErrorResponse {
    error: string;
    details?: any;
}
export interface AIConversationRow {
    id: number;
    user_id: string;
    title: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface AIMessageRow {
    id: number;
    conversation_id: number;
    role: 'user' | 'assistant';
    content: string;
    created_at: Date;
}
export interface IVScoreRow {
    id: number;
    user_id: string | null;
    symbol: string | null;
    score: number;
    level: string;
    vix: number | null;
    implied_points: number | null;
    color: string | null;
    confidence: number | null;
    factors: any | null;
    recommendation: string | null;
    instrument: string | null;
    timestamp: Date;
}
export interface ThreatHistoryRow {
    id: number;
    user_id: string;
    type: string;
    severity: string;
    description: string | null;
    metadata: any | null;
    created_at: Date;
}
export interface BlindSpotRow {
    id: number;
    user_id: string;
    name: string;
    is_guard_railed: boolean;
    is_active: boolean;
    category: string | null;
    source: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface PulseAnalysisRow {
    id: number;
    user_id: string | null;
    analysis: any;
    screenshot_url: string | null;
    created_at: Date;
    expires_at: Date;
}
export interface ScheduledEventRow {
    id: number;
    title: string;
    scheduled_time: Date;
    source: string | null;
    impact: string;
    symbols: string[] | null;
    is_commentary: boolean;
    event_type: string | null;
    created_at: Date;
}
//# sourceMappingURL=ai.d.ts.map