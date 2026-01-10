/**
 * Hono API Client
 * 
 * This client is designed to work with a Hono backend API.
 * Replace the base URL with your Hono backend endpoint.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if available
    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
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
          error.code = 'unauthenticated';
        } else if (response.status === 404) {
          error.code = 'not_found';
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
