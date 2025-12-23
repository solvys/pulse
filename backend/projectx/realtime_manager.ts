/**
 * TopstepX Real-time Connection Manager
 * Manages per-user SignalR connections and broadcasts updates to frontend clients
 */

import log from "encore.dev/log";
import { ai } from "~encore/clients";
import { UserHub } from "./realtime_user_hub";
import { MarketHub } from "./realtime_market_hub";
import { getAuthToken } from "./projectx_client";
import { getProjectXCredentials } from "./credentials";
import {
  GatewayUserAccount,
  GatewayUserOrder,
  GatewayUserPosition,
  GatewayUserTrade,
  GatewayQuote,
  GatewayDepth,
  GatewayTrade,
  RealtimeMessage,
  ConnectionStatus,
} from "./realtime_types";

/**
 * Represents a user's real-time connection session
 */
interface UserSession {
  userId: string;
  accountId: number;
  userHub: UserHub;
  marketHub: MarketHub;
  subscribedContracts: Set<string>;
  messageCallbacks: Set<(message: RealtimeMessage) => void>;
  createdAt: Date;
  lastActivity: Date;
}

/**
 * Singleton manager for all real-time connections
 */
class RealtimeManager {
  private sessions: Map<string, UserSession> = new Map();
  private static instance: RealtimeManager;

  private constructor() {
    // Cleanup stale sessions every 5 minutes
    setInterval(() => this.cleanupStaleSessions(), 5 * 60 * 1000);
  }

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  /**
   * Start a real-time session for a user
   */
  async startSession(
    userId: string,
    accountId: number,
    messageCallback: (message: RealtimeMessage) => void
  ): Promise<void> {
    const sessionKey = this.getSessionKey(userId, accountId);

    // If session already exists, just add the callback
    if (this.sessions.has(sessionKey)) {
      const session = this.sessions.get(sessionKey)!;
      session.messageCallbacks.add(messageCallback);
      session.lastActivity = new Date();
      log.info("Added callback to existing session", { userId, accountId });
      return;
    }

    try {
      // Get user's ProjectX credentials
      const credentials = await getProjectXCredentials(userId);
      const token = await getAuthToken(credentials.username, credentials.apiKey);

      // Create message broadcaster for this session
      const broadcast = (message: RealtimeMessage) => {
        // Send signal to Brain Observer
        ai.processSignal({
          userId,
          type: message.type,
          data: message.data,
          timestamp: message.timestamp,
        }).catch(err => {
          log.error("Failed to send signal to Brain Observer", { error: err });
        });

        const session = this.sessions.get(sessionKey);
        if (session) {
          session.messageCallbacks.forEach(cb => {
            try {
              cb(message);
            } catch (error) {
              log.error("Error in message callback", { userId, accountId, error });
            }
          });
        }
      };

      // Create User Hub connection
      const userHub = new UserHub(accountId, token, {
        onAccount: (data: GatewayUserAccount) => {
          broadcast({
            type: 'account',
            data,
            timestamp: new Date().toISOString(),
          });
        },
        onOrder: (data: GatewayUserOrder) => {
          broadcast({
            type: 'order',
            data,
            timestamp: new Date().toISOString(),
          });
        },
        onPosition: (data: GatewayUserPosition) => {
          broadcast({
            type: 'position',
            data,
            timestamp: new Date().toISOString(),
          });
        },
        onTrade: (data: GatewayUserTrade) => {
          broadcast({
            type: 'trade',
            data,
            timestamp: new Date().toISOString(),
          });
        },
      });

      // Create Market Hub connection
      const marketHub = new MarketHub(token, {
        onQuote: (contractId: string, data: GatewayQuote) => {
          broadcast({
            type: 'quote',
            data,
            timestamp: new Date().toISOString(),
            contractId,
          });
        },
        onDepth: (contractId: string, data: GatewayDepth) => {
          broadcast({
            type: 'depth',
            data,
            timestamp: new Date().toISOString(),
            contractId,
          });
        },
        onTrade: (contractId: string, data: GatewayTrade) => {
          broadcast({
            type: 'marketTrade',
            data,
            timestamp: new Date().toISOString(),
            contractId,
          });
        },
      });

      // Connect both hubs
      await userHub.connect();
      await marketHub.connect();

      // Store session
      const session: UserSession = {
        userId,
        accountId,
        userHub,
        marketHub,
        subscribedContracts: new Set(),
        messageCallbacks: new Set([messageCallback]),
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      this.sessions.set(sessionKey, session);
      log.info("Real-time session started", { userId, accountId });

    } catch (error) {
      log.error("Failed to start real-time session", {
        userId,
        accountId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Stop a real-time session for a user
   */
  async stopSession(userId: string, accountId: number, messageCallback?: (message: RealtimeMessage) => void): Promise<void> {
    const sessionKey = this.getSessionKey(userId, accountId);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      log.warn("Attempted to stop non-existent session", { userId, accountId });
      return;
    }

    // If a specific callback is provided, only remove that callback
    if (messageCallback) {
      session.messageCallbacks.delete(messageCallback);

      // If there are still active callbacks, don't stop the session
      if (session.messageCallbacks.size > 0) {
        log.info("Removed callback but keeping session active", {
          userId,
          accountId,
          remainingCallbacks: session.messageCallbacks.size
        });
        return;
      }
    }

    try {
      // Disconnect both hubs
      await session.userHub.disconnect();
      await session.marketHub.disconnect();

      // Remove session
      this.sessions.delete(sessionKey);
      log.info("Real-time session stopped", { userId, accountId });

    } catch (error) {
      log.error("Error stopping real-time session", {
        userId,
        accountId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Subscribe to market data for a contract
   */
  async subscribeContract(userId: string, accountId: number, contractId: string): Promise<void> {
    const sessionKey = this.getSessionKey(userId, accountId);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      throw new Error("Session not found. Please start a session first.");
    }

    try {
      await session.marketHub.subscribeContract(contractId);
      session.subscribedContracts.add(contractId);
      session.lastActivity = new Date();
      log.info("Subscribed to contract", { userId, accountId, contractId });
    } catch (error) {
      log.error("Failed to subscribe to contract", {
        userId,
        accountId,
        contractId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Unsubscribe from market data for a contract
   */
  async unsubscribeContract(userId: string, accountId: number, contractId: string): Promise<void> {
    const sessionKey = this.getSessionKey(userId, accountId);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      log.warn("Attempted to unsubscribe from non-existent session", { userId, accountId, contractId });
      return;
    }

    try {
      await session.marketHub.unsubscribeContract(contractId);
      session.subscribedContracts.delete(contractId);
      session.lastActivity = new Date();
      log.info("Unsubscribed from contract", { userId, accountId, contractId });
    } catch (error) {
      log.error("Failed to unsubscribe from contract", {
        userId,
        accountId,
        contractId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get connection status for a user
   */
  getConnectionStatus(userId: string, accountId: number): ConnectionStatus | null {
    const sessionKey = this.getSessionKey(userId, accountId);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return null;
    }

    const userHubState = session.userHub.getState();
    const marketHubState = session.marketHub.getState();

    return {
      userHub: userHubState === 'Connected' ? 'connected' :
               userHubState === 'Reconnecting' ? 'reconnecting' : 'disconnected',
      marketHub: marketHubState === 'Connected' ? 'connected' :
                 marketHubState === 'Reconnecting' ? 'reconnecting' : 'disconnected',
      subscribedContracts: Array.from(session.subscribedContracts),
      accountId: session.accountId,
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Array<{ userId: string; accountId: number; subscribedContracts: string[] }> {
    return Array.from(this.sessions.values()).map(session => ({
      userId: session.userId,
      accountId: session.accountId,
      subscribedContracts: Array.from(session.subscribedContracts),
    }));
  }

  /**
   * Cleanup sessions that have been inactive for more than 1 hour
   */
  private async cleanupStaleSessions(): Promise<void> {
    const now = new Date();
    const staleThreshold = 60 * 60 * 1000; // 1 hour

    for (const [sessionKey, session] of this.sessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();

      if (inactiveTime > staleThreshold) {
        log.info("Cleaning up stale session", {
          userId: session.userId,
          accountId: session.accountId,
          inactiveMinutes: Math.floor(inactiveTime / 60000)
        });

        await this.stopSession(session.userId, session.accountId);
      }
    }
  }

  /**
   * Generate a unique session key for a user and account
   */
  private getSessionKey(userId: string, accountId: number): string {
    return `${userId}:${accountId}`;
  }
}

// Export singleton instance
export const realtimeManager = RealtimeManager.getInstance();
