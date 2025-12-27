/**
 * ProjectX Service Wrapper for Autopilot
 * 
 * This service wraps ProjectX API calls with exact API compliance.
 * Follows docs/integration/PROJECTX-API.md exactly.
 */

import { sql } from '../db/index.js';

// ProjectX API enums (must match documentation exactly)
export enum OrderType {
  Limit = 1,
  Market = 2,
  StopLimit = 3,
  Stop = 4,
  TrailingStop = 5,
  JoinBid = 6,
  JoinAsk = 7,
}

export enum OrderSide {
  Bid = 0,  // Buy
  Ask = 1,  // Sell
}

export enum OrderStatus {
  None = 0,
  Open = 1,
  Filled = 2,
  Cancelled = 3,
  Expired = 4,
  Rejected = 5,
  Pending = 6,
}

interface ProjectXCredentials {
  username: string;
  apiKey: string;
}

interface PlaceOrderRequest {
  accountId: number;
  contractId: string;
  type: OrderType;
  side: OrderSide;
  size: number;
  limitPrice?: number | null;
  stopPrice?: number | null;
  trailPrice?: number | null;
  customTag?: string | null;
  stopLossBracket?: {
    ticks: number;
    type: OrderType;
  } | null;
  takeProfitBracket?: {
    ticks: number;
    type: OrderType;
  } | null;
}

interface PlaceOrderResponse {
  orderId: number;
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
}

const BASE_URL = 'https://api.topstepx.com/api';
const TIMEOUT_MS = 10000; // 10 seconds

/**
 * Get ProjectX credentials for a user
 * In test mode, uses test credentials from environment variables
 */
async function getProjectXCredentials(userId: string): Promise<ProjectXCredentials> {
  // Check if test mode is enabled
  if (process.env.AUTOPILOT_TEST_MODE === 'true') {
    const testUsername = process.env.PROJECTX_TEST_USERNAME;
    const testApiKey = process.env.PROJECTX_TEST_API_KEY;
    
    if (testUsername && testApiKey) {
      return {
        username: testUsername,
        apiKey: testApiKey,
      };
    }
  }

  // Get credentials from database
  const [credential] = await sql`
    SELECT username, api_key
    FROM projectx_credentials
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (!credential) {
    throw new Error('ProjectX credentials not found. Please configure your credentials in settings.');
  }

  return {
    username: credential.username,
    apiKey: credential.api_key,
  };
}

/**
 * Get authentication token from ProjectX
 */
async function getAuthToken(username: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/Auth/loginKey`, {
      method: 'POST',
      headers: {
        'Accept': 'text/plain',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userName: username,
        apiKey: apiKey,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded for ProjectX API');
      }
      throw new Error(`ProjectX auth failed: ${response.status}`);
    }

    const data = await response.json() as {
      token: string;
      success: boolean;
      errorCode: number;
      errorMessage: string | null;
    };

    if (!data.success || data.errorCode !== 0) {
      throw new Error(`ProjectX auth failed: ${data.errorMessage || 'Unknown error'}`);
    }

    return data.token;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('ProjectX API request timeout');
    }
    throw error;
  }
}

/**
 * Place order via ProjectX API
 * Follows exact API specification from docs/integration/PROJECTX-API.md
 */
export async function placeOrder(
  userId: string,
  orderRequest: PlaceOrderRequest
): Promise<PlaceOrderResponse> {
  const credentials = await getProjectXCredentials(userId);
  const token = await getAuthToken(credentials.username, credentials.apiKey);

  // Build request body exactly as specified in documentation
  const requestBody: any = {
    accountId: orderRequest.accountId,
    contractId: orderRequest.contractId,
    type: orderRequest.type,
    side: orderRequest.side,
    size: orderRequest.size,
  };

  // Add optional fields only if provided (not undefined)
  if (orderRequest.limitPrice !== undefined && orderRequest.limitPrice !== null) {
    requestBody.limitPrice = orderRequest.limitPrice;
  }
  if (orderRequest.stopPrice !== undefined && orderRequest.stopPrice !== null) {
    requestBody.stopPrice = orderRequest.stopPrice;
  }
  if (orderRequest.trailPrice !== undefined && orderRequest.trailPrice !== null) {
    requestBody.trailPrice = orderRequest.trailPrice;
  }
  if (orderRequest.customTag !== undefined && orderRequest.customTag !== null) {
    requestBody.customTag = orderRequest.customTag;
  }
  if (orderRequest.stopLossBracket) {
    requestBody.stopLossBracket = {
      ticks: orderRequest.stopLossBracket.ticks,
      type: orderRequest.stopLossBracket.type,
    };
  }
  if (orderRequest.takeProfitBracket) {
    requestBody.takeProfitBracket = {
      ticks: orderRequest.takeProfitBracket.ticks,
      type: orderRequest.takeProfitBracket.type,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/Order/place`, {
      method: 'POST',
      headers: {
        'Accept': 'text/plain',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded for ProjectX API');
      }
      if (response.status === 401) {
        throw new Error('ProjectX authentication failed');
      }
      if (response.status === 400) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(`ProjectX bad request: ${(errorBody as any).errorMessage || 'Invalid request'}`);
      }
      throw new Error(`ProjectX API error: ${response.status}`);
    }

    const result = await response.json() as PlaceOrderResponse;

    if (!result.success) {
      throw new Error(`ProjectX order placement failed: ${result.errorMessage || 'Unknown error'} (Error Code: ${result.errorCode || 'N/A'})`);
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('ProjectX API request timeout');
    }
    throw error;
  }
}

/**
 * Search contracts by symbol
 */
export async function searchContracts(
  userId: string,
  searchText: string,
  live: boolean = false
): Promise<Array<{
  id: string;
  name: string;
  description: string;
  tickSize: number;
  tickValue: number;
  activeContract: boolean;
  symbolId: string;
}>> {
  const credentials = await getProjectXCredentials(userId);
  const token = await getAuthToken(credentials.username, credentials.apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/Contract/search`, {
      method: 'POST',
      headers: {
        'Accept': 'text/plain',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        searchText,
        live,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded for ProjectX API');
      }
      throw new Error(`Failed to search contracts: ${response.status}`);
    }

    const data = await response.json() as {
      contracts?: Array<{
        id: string;
        name: string;
        description: string;
        tickSize: number;
        tickValue: number;
        activeContract: boolean;
        symbolId: string;
      }>;
      success: boolean;
      errorMessage?: string;
    };

    if (!data.success) {
      throw new Error(`Failed to search contracts: ${data.errorMessage || 'Unknown error'}`);
    }

    return data.contracts || [];
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('ProjectX API request timeout');
    }
    throw error;
  }
}
