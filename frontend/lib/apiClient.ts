/**
 * Hono API Client
 * 
 * This client is designed to work with a Hono backend API.
 * Replace the base URL with your Hono backend endpoint.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
import { signOutUser } from './authHelper';

// Global auth failure state - stops all polling when auth fails
let authFailed = false;
let authFailedTimestamp: number | null = null;
let signOutInProgress = false; // Prevent multiple simultaneous sign-outs
const AUTH_RETRY_DELAY_MS = 30000; // Wait 30s before retrying after auth failure
const MAX_401_COUNT = 3; // Maximum consecutive 401s before giving up
let consecutive401Count = 0;
let last401Timestamp: number | null = null;

// Export function to reset auth state (call on successful login)
export function resetAuthState() {
  authFailed = false;
  authFailedTimestamp = null;
  consecutive401Count = 0;
  last401Timestamp = null;
  signOutInProgress = false;
}

// Check if auth has failed and we should skip requests
function shouldSkipRequest(): boolean {
  if (!authFailed) return false;
  
  // Reset if enough time has passed
  if (authFailedTimestamp && Date.now() - authFailedTimestamp > AUTH_RETRY_DELAY_MS) {
    authFailed = false;
    authFailedTimestamp = null;
    consecutive401Count = 0;
    return false;
  }
  
  return true;
}

// Track 401 errors to prevent flooding
function handle401Error(): void {
  const now = Date.now();
  
  // Reset counter if it's been more than 1 minute since last 401
  if (last401Timestamp && now - last401Timestamp > 60000) {
    consecutive401Count = 0;
  }
  
  consecutive401Count++;
  last401Timestamp = now;
  
  // Set global auth failure flag to stop future requests
  authFailed = true;
  authFailedTimestamp = now;
  
  // Only sign out once, and only if we've seen multiple 401s
  if (consecutive401Count >= MAX_401_COUNT && !signOutInProgress) {
    signOutInProgress = true;
    console.warn(`[API] Multiple auth failures (${consecutive401Count}). Signing out to allow re-authentication`);
    
    signOutUser()
      .then(() => {
        console.log('[API] Successfully signed out after auth failures');
      })
      .catch((err) => {
        console.error('[API] Error signing out on 401:', err);
      })
      .finally(() => {
        // Reset sign out flag after a delay to allow retry
        setTimeout(() => {
          signOutInProgress = false;
        }, 5000);
      });
  } else if (consecutive401Count < MAX_401_COUNT) {
    console.warn(`[API] Auth failed (${consecutive401Count}/${MAX_401_COUNT}). Will retry or sign out if continues.`);
  }
}

export interface ApiError {
  code: string;
  message: string;
  status?: number;
}

class ApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(baseUrl: string = API_BASE_URL, getAuthToken?: () => Promise<string | null>) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.getAuthToken = getAuthToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Skip request if auth has failed recently (prevents error cascade)
    if (shouldSkipRequest()) {
      throw {
        code: 'auth_skipped',
        message: 'Skipping request due to recent auth failure. Will retry in 30s.',
        status: 401,
      } as ApiError;
    }

    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if available
    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        const error: ApiError = {
          code: errorData.code || `http_${response.status}`,
          message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };

        // Handle specific status codes
        if (response.status === 401) {
          error.code = errorData.code || 'unauthenticated';
          handle401Error();
        } else if (response.status === 404) {
          error.code = 'not_found';
        } else if (response.status >= 500) {
          error.code = 'server_error';
          console.error(`[API] Server error ${response.status} for ${endpoint}:`, errorData);
        }
        
        // Reset 401 counter on successful requests
        if (response.status !== 401) {
          consecutive401Count = 0;
          last401Timestamp = null;
        }

        throw error;
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }
      throw {
        code: 'network_error',
        message: error instanceof Error ? error.message : 'Network request failed',
      } as ApiError;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Create a new client instance with updated auth token getter
  withAuth(getAuthToken: () => Promise<string | null>): ApiClient {
    return new ApiClient(this.baseUrl, getAuthToken);
  }
}

export default ApiClient;
