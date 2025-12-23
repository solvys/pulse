import {HubConnection, HubConnectionBuilder, HttpTransportType} from "@microsoft/signalr";
import { getAuthToken } from "./projectx_client";
import { getActiveContract } from "./contract_mapper";
import log from "encore.dev/log";

interface MarketQuote {
  symbol: string;
  symbolName: string;
  lastPrice: number;
  bestBid: number;
  bestAsk: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  lastUpdated: string;
  timestamp: string;
}

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

class MarketDataService {
  private connection: HubConnection | null = null;
  private quotes: Map<string, MarketQuote> = new Map();
  private subscribedContracts: Set<string> = new Set();
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  async connect(): Promise<void> {
    if (this.connected && this.connection) {
      return;
    }

    try {
      const token = await getAuthToken();
      const marketHubUrl = `https://rtc.topstepx.com/hubs/market`;

      this.connection = new HubConnectionBuilder()
        .withUrl(marketHubUrl, {
          skipNegotiation: true,
          transport: HttpTransportType.WebSockets,
          accessTokenFactory: () => token,
          timeout: 10000
        })
        .withAutomaticReconnect()
        .build();

      this.connection.on('GatewayQuote', (contractId: string, data: MarketQuote) => {
        this.quotes.set(contractId, data);
        log.info("Market quote received", {
          contractId,
          symbol: data.symbol,
          lastPrice: data.lastPrice,
          bestBid: data.bestBid,
          bestAsk: data.bestAsk
        });
      });

      this.connection.onreconnected(() => {
        log.info("Market data connection reconnected");
        this.reconnectAttempts = 0;
        this.resubscribeAll();
      });

      this.connection.onclose((error) => {
        log.warn("Market data connection closed", { error });
        this.connected = false;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 5000 * this.reconnectAttempts);
        }
      });

      await this.connection.start();
      this.connected = true;
      this.reconnectAttempts = 0;
      log.info("Market data connection established");
    } catch (error) {
      log.error("Failed to connect to market data hub", { error });
      throw error;
    }
  }

  async subscribeToSymbol(symbol: string, live: boolean = true): Promise<void> {
    if (!this.connected || !this.connection) {
      await this.connect();
    }

    try {
      const contract = await getActiveContract(symbol, live);

      if (this.subscribedContracts.has(contract.id)) {
        return;
      }

      await this.connection!.invoke('SubscribeContractQuotes', contract.id);
      this.subscribedContracts.add(contract.id);

      log.info("Subscribed to contract quotes", {
        symbol,
        contractId: contract.id,
        contractName: contract.name
      });
    } catch (error) {
      log.error("Failed to subscribe to symbol", { symbol, error });
      throw error;
    }
  }

  async unsubscribeFromSymbol(symbol: string, live: boolean = true): Promise<void> {
    if (!this.connected || !this.connection) {
      return;
    }

    try {
      const contract = await getActiveContract(symbol, live);

      if (!this.subscribedContracts.has(contract.id)) {
        return;
      }

      await this.connection!.invoke('UnsubscribeContractQuotes', contract.id);
      this.subscribedContracts.delete(contract.id);
      this.quotes.delete(contract.id);

      log.info("Unsubscribed from contract quotes", {
        symbol,
        contractId: contract.id
      });
    } catch (error) {
      log.error("Failed to unsubscribe from symbol", { symbol, error });
    }
  }

  private async resubscribeAll(): Promise<void> {
    const contracts = Array.from(this.subscribedContracts);
    this.subscribedContracts.clear();

    for (const contractId of contracts) {
      try {
        await this.connection!.invoke('SubscribeContractQuotes', contractId);
        this.subscribedContracts.add(contractId);
      } catch (error) {
        log.error("Failed to resubscribe to contract", { contractId, error });
      }
    }
  }

  async getCurrentPrice(symbol: string, live: boolean = true): Promise<number | null> {
    try {
      const contract = await getActiveContract(symbol, live);
      const quote = this.quotes.get(contract.id);

      if (!quote) {
        // If no quote available yet, subscribe and return null
        if (!this.subscribedContracts.has(contract.id)) {
          await this.subscribeToSymbol(symbol, live);
        }
        return null;
      }

      // Return mid-price (average of bid and ask)
      return (quote.bestBid + quote.bestAsk) / 2;
    } catch (error) {
      log.error("Failed to get current price", { symbol, error });
      return null;
    }
  }

  getQuote(contractId: string): MarketQuote | null {
    return this.quotes.get(contractId) || null;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connected = false;
      this.subscribedContracts.clear();
      this.quotes.clear();
      log.info("Market data connection disconnected");
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance
export const marketDataService = new MarketDataService();

