/**
 * useChatWithAuth Hook
 * Custom hook for chat with authentication
 */

import { useCallback, useState, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { API_BASE_URL } from '../constants.js';

export function useChatWithAuth(conversationId: string | undefined, setConversationId: (id: string) => void) {
  const { getToken, isSignedIn, userId } = useAuth();
  const clerk = useClerk();
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Track retry attempts to prevent infinite loops
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 1;
  
  // Log auth state for debugging
  if (!isSignedIn) {
    console.warn('[useChatWithAuth] User is not signed in. Token requests will fail.');
  }

  // Helper function to redirect to sign-in
  const redirectToSignIn = useCallback(async () => {
    console.warn('[useChatWithAuth] Authentication failed. Signing out to allow re-authentication.');
    // Sign out from Clerk first, which will trigger the SignedOut component
    // to show the inline SignIn component that's already configured in App.tsx
    // This ensures the user gets a fresh token when they sign in again
    try {
      if (clerk.signOut) {
        await clerk.signOut();
        // After signing out, the SignedOut component will automatically show
        // No need to reload - Clerk will handle the UI update
      } else {
        // Fallback: reload the page
        window.location.reload();
      }
    } catch (error) {
      console.error('[useChatWithAuth] Error signing out:', error);
      // Fallback: reload the page anyway
      window.location.reload();
    }
  }, [clerk]);

  const fetchWithAuth = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Try to get a fresh token - Clerk handles caching internally
    let token = await getToken({ template: 'neon' });
    
    // If token is null, try getting it without template as fallback
    if (!token) {
      console.warn('[useChatWithAuth] No token with neon template, trying default token...');
      token = await getToken();
    }
    
    // Ensure token is available before making the request
    if (!token) {
      console.error('[useChatWithAuth] No authentication token available. User may need to sign in.');
      throw new Error('Authentication required. Please sign in to continue.');
    }
    
    // Log token info for debugging (first 20 chars only for security)
    console.log('[useChatWithAuth] Token obtained:', {
      hasToken: !!token,
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + '...',
      isSignedIn,
      userId,
    });

    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`, // Always set Authorization header since we've verified token exists
      ...(init?.headers as Record<string, string> || {}),
    };

    let body = init?.body;
    if (body && conversationId) {
      try {
        const bodyObj = typeof body === 'string' ? JSON.parse(body) : body;
        if (typeof bodyObj === 'object' && bodyObj !== null) {
          bodyObj.conversationId = conversationId;
          body = JSON.stringify(bodyObj);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    const response = await fetch(fullUrl, {
      ...init,
      headers: headers as HeadersInit,
      body,
    });

    // Handle 401 Unauthorized responses
    if (response.status === 401) {
      const errorText = await response.text().catch(() => 'Unauthorized');
      console.error('[useChatWithAuth] 401 Unauthorized - Token may be expired or invalid', {
        errorText,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 50) + '...',
        retryCount: retryCountRef.current,
      });
      
      // Only attempt retry if we haven't exceeded max retries
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        
        try {
          // Try to get a fresh token with skipCache to force refresh
          const freshToken = await getToken({ template: 'neon', skipCache: true });
          
          if (freshToken && freshToken !== token) {
            console.log('[useChatWithAuth] Got fresh token. Retrying request with new token.');
            
            // Retry the original request with the fresh token
            const retryHeaders: Record<string, string> = {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${freshToken}`,
              ...(init?.headers as Record<string, string> || {}),
            };
            
            const retryResponse = await fetch(fullUrl, {
              ...init,
              headers: retryHeaders as HeadersInit,
              body,
            });
            
            // Reset retry count on success
            if (retryResponse.status !== 401) {
              retryCountRef.current = 0;
              
              const convId = retryResponse.headers.get('X-Conversation-Id');
              if (convId) {
                setConversationId(convId);
              }
              
              return retryResponse;
            } else {
              // Still 401 after retry - token refresh didn't help
              console.error('[useChatWithAuth] Retry with fresh token still returned 401. Redirecting to sign-in.');
              redirectToSignIn();
              throw new Error(`Authentication failed: ${errorText}`);
            }
          } else if (!freshToken) {
            // Failed to get fresh token - user needs to sign in again
            console.error('[useChatWithAuth] Failed to get fresh token, redirecting to login.');
            redirectToSignIn();
            throw new Error(`Authentication failed: Unable to refresh token. Please sign in again.`);
          } else {
            // Got same token - likely expired or invalid
            console.warn('[useChatWithAuth] Got fresh token, but it\'s the same as the old one. Token may be expired. Redirecting to sign-in.');
            redirectToSignIn();
            throw new Error(`Authentication failed: Token expired. Please sign in again.`);
          }
        } catch (refreshError) {
          // If refreshing token fails, user likely needs to log in again
          console.error('[useChatWithAuth] Failed to get fresh token:', refreshError);
          redirectToSignIn();
          throw new Error(`Authentication failed: Unable to refresh token. Please sign in again.`);
        }
      } else {
        // Max retries exceeded - redirect to sign-in
        console.error('[useChatWithAuth] Max retries exceeded. Redirecting to sign-in.');
        retryCountRef.current = 0; // Reset for next attempt
        redirectToSignIn();
        throw new Error(`Authentication failed: ${errorText}`);
      }
    }
    
    // Reset retry count on successful response
    retryCountRef.current = 0;

    const convId = response.headers.get('X-Conversation-Id');
    if (convId) {
      setConversationId(convId);
    }

    return response;
  }, [getToken, conversationId, setConversationId, redirectToSignIn]);

  const {
    messages: useChatMessages,
    sendMessage,
    status,
    setMessages: setUseChatMessages,
    stop,
  } = useChat({
    transport: new DefaultChatTransport({
      api: `${API_BASE_URL}/api/ai/chat`,
      fetch: fetchWithAuth,
      prepareSendMessagesRequest: ({ messages, id }) => {
        const lastMessage = messages[messages.length - 1];
        const textContent = lastMessage.parts
          ?.filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('') || '';

        return {
          body: {
            messages: messages.map((msg) => ({
              role: msg.role,
              content: msg.parts
                ?.filter((part: any) => part.type === 'text')
                .map((part: any) => part.text)
                .join('') || '',
            })),
            conversationId: conversationId || id,
          },
        };
      },
    }),
    onFinish: () => {
      setIsStreaming(false);
    },
    onError: () => {
      setIsStreaming(false);
    },
  });

  const isLoading = isStreaming || status === 'streaming' || status === 'submitted';

  return {
    messages: useChatMessages,
    sendMessage,
    status,
    setMessages: setUseChatMessages,
    isLoading,
    setIsStreaming,
    stop,
  };
}
