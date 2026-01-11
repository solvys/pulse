/**
 * AI Chat Handler
 * Handle chat messages and AI responses - Vercel AI SDK compatible
 * Enhanced with comprehensive logging for streaming issues
 */

import type { Context } from 'hono'
import { streamText, generateText } from 'ai'
import { selectModel, createModelClient, logModelSelection, markProviderUnhealthy, getFallbackModel, type AiModelKey } from '../../../services/ai/model-selector.js'
import * as conversationStore from '../../../services/ai/conversation-store.js'
import { defaultAiConfig } from '../../../config/ai-config.js'
import type { ChatRequest } from '../../../types/ai-chat.js'

// Timeout for streaming responses (60 seconds)
const STREAM_TIMEOUT_MS = 60_000

/**
 * POST /api/ai/chat
 * Vercel AI SDK compatible streaming endpoint
 */
export async function handleChat(c: Context) {
  const startTime = Date.now()
  const requestId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`
  const userId = c.get('userId') as string | undefined

  console.log(`[AI Chat][${requestId}] Request started`)

  if (!userId) {
    console.warn(`[AI Chat][${requestId}] Unauthorized - no userId`)
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const body = await c.req.json<ChatRequest & { messages?: { role: string; content: string }[] }>().catch((err) => {
      console.error(`[AI Chat][${requestId}] Failed to parse request body:`, err)
      return null
    })

    // Support both 'message' (string) and 'messages' (array from Vercel AI SDK)
    let message = body?.message?.trim() ?? ''
    if (!message && body?.messages?.length) {
      const lastUserMsg = [...body.messages].reverse().find(m => m.role === 'user')
      message = lastUserMsg?.content?.trim() ?? ''
    }

    if (!message) {
      console.warn(`[AI Chat][${requestId}] Empty message`)
      return c.json({ error: 'Message is required' }, 400)
    }

    console.log(`[AI Chat][${requestId}] Message: "${message.substring(0, 50)}..." (${message.length} chars)`)

    const { conversationId, model, taskType } = body ?? {}

    // Get or create conversation
    let conversation = conversationId 
      ? await conversationStore.getConversation(conversationId, userId)
      : null

    if (conversationId && !conversation) {
      console.log(`[AI Chat][${requestId}] Conversation ${conversationId} not found, creating new`)
      conversation = null
    }

    if (!conversation) {
      const title = conversationStore.generateTitle(message)
      conversation = await conversationStore.createConversation(userId, { title, model })
      console.log(`[AI Chat][${requestId}] Created conversation: ${conversation.id}`)
    } else {
      console.log(`[AI Chat][${requestId}] Using existing conversation: ${conversation.id}`)
    }

    // Store user message
    await conversationStore.addMessage(conversation.id, {
      conversationId: conversation.id,
      role: 'user',
      content: message,
    })
    console.log(`[AI Chat][${requestId}] User message saved`)

    // Get conversation history
    const history = await conversationStore.getRecentContext(conversation.id)
    console.log(`[AI Chat][${requestId}] History: ${history.length} messages`)

    // Select model - using OpenRouter with Grok 4.1 primary
    const selection = selectModel({
      preferredModel: model,
      taskType: taskType ?? 'chat',
      messageCount: history.length,
      inputChars: message.length,
    })

    logModelSelection(selection, { preferredModel: model, taskType })
    console.log(`[AI Chat][${requestId}] Selected model: ${selection.model} (provider: ${selection.provider})`)

    const systemPrompt = defaultAiConfig.systemPrompt ?? 'You are a helpful AI trading assistant.'
    
    let aiModel
    try {
      aiModel = createModelClient(selection.model as AiModelKey)
      console.log(`[AI Chat][${requestId}] Model client created successfully`)
    } catch (err) {
      console.error(`[AI Chat][${requestId}] Failed to create model client:`, err)
      
      // Try fallback model
      const fallback = getFallbackModel(selection.model as AiModelKey)
      if (fallback) {
        console.log(`[AI Chat][${requestId}] Trying fallback model: ${fallback.model}`)
        markProviderUnhealthy(selection.provider)
        aiModel = createModelClient(fallback.model as AiModelKey)
      } else {
        throw err
      }
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: message },
    ]

    console.log(`[AI Chat][${requestId}] Calling streamText with ${messages.length} messages (system + ${history.length} history + 1 user)`)

    // Track streaming progress
    let chunksReceived = 0
    let totalChars = 0
    let lastChunkTime = Date.now()
    let streamCompleted = false
    let streamError: Error | null = null

    // Stream response using Vercel AI SDK with enhanced error handling
    const result = streamText({
      model: aiModel,
      messages,
      temperature: 0.4,
      maxOutputTokens: 4096, // Increased for longer responses
      abortSignal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
      onChunk: ({ chunk }) => {
        chunksReceived++
        const now = Date.now()
        const timeSinceLastChunk = now - lastChunkTime
        lastChunkTime = now
        
        // Log every 10 chunks or if there's a significant delay
        if (chunksReceived % 10 === 0 || timeSinceLastChunk > 5000) {
          console.log(`[AI Chat][${requestId}] Chunk #${chunksReceived}, gap: ${timeSinceLastChunk}ms, type: ${chunk.type}`)
        }
        
        if (chunk.type === 'text-delta' && chunk.textDelta) {
          totalChars += chunk.textDelta.length
        }
      },
      onFinish: async ({ text, finishReason, usage }) => {
        streamCompleted = true
        const duration = Date.now() - startTime
        
        console.log(`[AI Chat][${requestId}] Stream finished:`, {
          finishReason,
          chunks: chunksReceived,
          chars: text.length,
          duration: `${duration}ms`,
          usage: usage ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          } : 'N/A',
        })
        
        // Store assistant message after streaming completes
        try {
          await conversationStore.addMessage(conversation!.id, {
            conversationId: conversation!.id,
            role: 'assistant',
            content: text,
            model: selection.model,
          })
          console.log(`[AI Chat][${requestId}] Assistant message saved (${text.length} chars)`)
        } catch (saveErr) {
          console.error(`[AI Chat][${requestId}] Failed to save assistant message:`, saveErr)
        }
      },
      onError: (event) => {
        streamError = event.error as Error
        const duration = Date.now() - startTime
        console.error(`[AI Chat][${requestId}] Stream error after ${duration}ms:`, {
          error: streamError.message,
          chunksReceived,
          charsReceived: totalChars,
        })
      },
    })
    
    console.log(`[AI Chat][${requestId}] streamText initiated, returning stream response`)

    // Set conversation ID header so frontend can track it
    c.header('X-Conversation-Id', conversation.id)

    // Return Vercel AI SDK UI message stream (what useChat expects)
    return result.toUIMessageStreamResponse({
      headers: {
        'X-Conversation-Id': conversation.id,
        'X-Request-Id': requestId,
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[AI Chat][${requestId}] Fatal error after ${duration}ms:`, error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to process chat message'
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMessage = 'Request timed out. The AI model took too long to respond. Please try again.'
      } else if (error.message.includes('API key')) {
        errorMessage = 'AI service configuration error. Please contact support.'
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.'
      }
    }
    
    return c.json({ 
      error: errorMessage,
      requestId,
      duration: `${duration}ms`,
    }, 500)
  }
}

/**
 * POST /api/ai/chat/stream (legacy SSE endpoint)
 */
export async function handleChatStream(c: Context) {
  // Redirect to main handler - it's now streaming
  return handleChat(c)
}
