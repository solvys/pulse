/**
 * Chat Types
 * Type definitions for chat interface
 */

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface TiltWarning {
  detected: boolean;
  score?: number;
  message?: string;
}

export interface ConversationSession {
  conversationId: string;
  updatedAt: Date;
  messageCount: number;
  preview: string;
  erStatus?: "Stable" | "Tilt" | "Neutral";
  pnl?: number;
  isArchived?: boolean;
  isPinned?: boolean;
  customName?: string;
  isStale?: boolean; // Stale after 24 hours
}
