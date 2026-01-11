/**
 * AI Chat Handler
 * Handle chat messages and AI responses - Vercel AI SDK compatible
 */

import type { Context } from 'hono'
import { streamText, generateText } from 'ai'
import { selectModel, createModelClient, logModelSelection, type AiModelKey } from '../../../services/ai/model-selector.js'
import * as conversationStore from '../../../services/ai/conversation-store.js'
import { defaultAiConfig } from '../../../config/ai-config.js'
import type { ChatRequest } from '../../../types/ai-chat.js'

/**
 * POST /api/ai/chat
 * Vercel AI SDK compatible streaming endpoint
 */
export async function handleChat(c: Context) {
  const userId = c.get('userId') as string | undefined

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const body = await c.req.json<ChatRequest & { messages?: { role: string; content: string }[] }>().catch(() => null)

    // Support both 'message' (string) and 'messages' (array from Vercel AI SDK)
    let message = body?.message?.trim() ?? ''
    if (!message && body?.messages?.length) {
      const lastUserMsg = [...body.messages].reverse().find(m => m.role === 'user')
      message = lastUserMsg?.content?.trim() ?? ''
    }

    if (!message) {
      return c.json({ error: 'Message is required' }, 400)
    }

    const { conversationId, model, taskType } = body ?? {}

    // Get or create conversation
    let conversation = conversationId 
      ? await conversationStore.getConversation(conversationId, userId)
      : null

    if (conversationId && !conversation) {
      // Create new if not found (frontend might send stale ID)
      conversation = null
    }

    if (!conversation) {
      const title = conversationStore.generateTitle(message)
      conversation = await conversationStore.createConversation(userId, { title, model })
    }

    // Store user message
    await conversationStore.addMessage(conversation.id, {
      conversationId: conversation.id,
      role: 'user',
      content: message,
    })

    // Get conversation history
    const history = await conversationStore.getRecentContext(conversation.id)

    // Select model - using OpenRouter
    const selection = selectModel({
      preferredModel: model,
      taskType: taskType ?? 'chat',
      messageCount: history.length,
      inputChars: message.length,
    })

    logModelSelection(selection, { preferredModel: model, taskType })
    console.log(`[AI Chat] Using model: ${selection.model}`)

    const systemPrompt = defaultAiConfig.systemPrompt ?? 'You are a helpful AI trading assistant.'
    
    let aiModel
    try {
      aiModel = createModelClient(selection.model as AiModelKey)
      console.log(`[AI Chat] Model client created successfully`)
    } catch (err) {
      console.error(`[AI Chat] Failed to create model client:`, err)
      throw err
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: message },
    ]

    console.log(`[AI Chat] Calling streamText with ${messages.length} messages`)

    // Stream response using Vercel AI SDK
    const result = streamText({
      model: aiModel,
      messages,
      temperature: 0.4,
      maxOutputTokens: 2048,
      onFinish: async ({ text }) => {
        console.log(`[AI Chat] Stream finished, saving response (${text.length} chars)`)
        // Store assistant message after streaming completes
        await conversationStore.addMessage(conversation!.id, {
          conversationId: conversation!.id,
          role: 'assistant',
          content: text,
          model: selection.model,
        })
      },
    })
    
    console.log(`[AI Chat] streamText called, returning response`)

    // Set conversation ID header so frontend can track it
    c.header('X-Conversation-Id', conversation.id)

    // Return Vercel AI SDK UI message stream (what useChat expects)
    return result.toUIMessageStreamResponse({
      headers: {
        'X-Conversation-Id': conversation.id,
      },
    })
  } catch (error) {
    console.error('[AI Chat] Error:', error)
    return c.json({ error: 'Failed to process chat message' }, 500)
  }
}

/**
 * POST /api/ai/chat/stream (legacy SSE endpoint)
 */
export async function handleChatStream(c: Context) {
  // Redirect to main handler - it's now streaming
  return handleChat(c)
}
