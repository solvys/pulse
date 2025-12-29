import { useAuth, useClerk } from "@clerk/clerk-react";
import { useMemo, useEffect } from "react";
import ApiClient from "./apiClient";
import { createBackendClient, type BackendClient } from "./services";
import { registerSignOutCallback } from "./authHelper";

// Development mode: bypass Clerk authentication ONLY when explicitly enabled
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const BYPASS_AUTH = DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true';

// Create base API client
const baseApiClient = new ApiClient();
const baseBackendClient = createBackendClient(baseApiClient);

// Hook for when Clerk is available (normal mode)
function useBackendWithClerk(): BackendClient {
  const { getToken, isSignedIn } = useAuth();
  const clerk = useClerk();

  // Register sign-out callback for use in ApiClient
  useEffect(() => {
    if (clerk.signOut) {
      registerSignOutCallback(() => clerk.signOut());
    }
  }, [clerk]);

  return useMemo(() => {
    if (!isSignedIn) {
      return baseBackendClient;
    }

    const authenticatedClient = baseApiClient.withAuth(async () => {
      const token = await getToken({ template: 'neon' });
      return token;
    });

    return createBackendClient(authenticatedClient);
  }, [isSignedIn, getToken]);
}

// Hook for dev mode without Clerk
function useBackendWithoutAuth(): BackendClient {
  return baseBackendClient;
}

// Export the appropriate hook based on environment
export const useBackend = BYPASS_AUTH ? useBackendWithoutAuth : useBackendWithClerk;

// Export default client for non-hook usage
export default baseBackendClient;

// Re-export types and services
export { default as ApiClient } from "./apiClient";
export * from "./services";

