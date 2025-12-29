/**
 * useChatWithAuth Hook
 * Custom hook for chat with authentication
 */

import { useCallback, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuth } from '@clerk/clerk-react';
import { API_BASE_URL } from '../constants.js';

export function useChatWithAuth(conversationId: string | undefined, setConversationId: (id: string) => void) {
  const { getToken } = useAuth();
  const [isStreaming, setIsStreaming] = useState(false);

  const fetchWithAuth = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const token = await getToken();
    
    // Ensure token is available before making the request
    if (!token) {
      console.error('[useChatWithAuth] No authentication token available. User may need to sign in.');
      throw new Error('Authentication required. Please sign in to continue.');
    }

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
      console.error('[useChatWithAuth] 401 Unauthorized - Token may be expired or invalid');
      const errorText = await response.text().catch(() => 'Unauthorized');
      throw new Error(`Authentication failed: ${errorText}`);
    }

    const convId = response.headers.get('X-Conversation-Id');
    if (convId) {
      setConversationId(convId);
    }

    return response;
  }, [getToken, conversationId, setConversationId]);

  const {
    messages: useChatMessages,
    sendMessage,
    status,
    setMessages: setUseChatMessages,
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
  };
}
