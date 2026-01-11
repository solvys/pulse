/**
 * AI Chat Handler
 * Handle chat messages and AI responses
 * Day 19 - Phase 5 Implementation
 */

import type { Context } from 'hono'
import { generateText, streamText } from 'ai'
import { selectModel, createModelClient, getFallbackModel, logModelSelection, type AiModelKey } from '../../../services/ai/model-selector.js'
import * as conversationStore from '../../../services/ai/conversation-store.js'
import { defaultAiConfig } from '../../../config/ai-config.js'
import type { ChatRequest, ChatResponse } from '../../../types/ai-chat.js'

const isDev = process.env.NODE_ENV !== 'production'

/**
 * POST /api/ai/chat
 * Send a message and get AI response
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
      return c.json({ error: 'Conversation not found' }, 404)
    }

    if (!conversation) {
      // Create new conversation
      const title = conversationStore.generateTitle(message)
      conversation = await conversationStore.createConversation(userId, {
        title,
        model,
      })
    }

    // Store user message
    await conversationStore.addMessage(conversation.id, {
      conversationId: conversation.id,
      role: 'user',
      content: message,
    })

    // Get conversation history for context
    const history = await conversationStore.getRecentContext(conversation.id)

    // Select model based on task type
    const selection = selectModel({
      preferredModel: model,
      taskType: taskType ?? 'chat',
      messageCount: history.length,
      inputChars: message.length,
    })

    logModelSelection(selection, { preferredModel: model, taskType })

    // Generate AI response
    const response = await generateAiResponse(selection.model, message, history)

    // Store assistant message
    const assistantMessage = await conversationStore.addMessage(conversation.id, {
      conversationId: conversation.id,
      role: 'assistant',
      content: response.content,
      model: selection.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      totalTokens: response.totalTokens,
      costUsd: response.costUsd,
    })

    // Update conversation title if it was auto-generated and this is a significant response
    if (conversation.title.endsWith('...') && response.content.length > 50) {
      await conversationStore.updateConversation(conversation.id, userId, {
        title: conversationStore.generateTitle(message),
      })
    }

    const chatResponse: ChatResponse = {
      id: assistantMessage.id,
      conversationId: conversation.id,
      role: 'assistant',
      content: response.content,
      model: selection.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      totalTokens: response.totalTokens,
      costUsd: response.costUsd,
      createdAt: assistantMessage.createdAt,
    }

    return c.json(chatResponse)
  } catch (error) {
    console.error('[AI Chat] Error:', error)
    return c.json({ error: 'Failed to process chat message' }, 500)
  }
}

/**
 * Generate AI response with fallback handling
 */
async function generateAiResponse(
  modelKey: string,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  triedModels: Set<string> = new Set()
): Promise<{
  content: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  costUsd?: number
}> {
  // Prevent infinite loop - track which models we've tried
  if (triedModels.has(modelKey)) {
    throw new Error(`All fallback models exhausted. Tried: ${Array.from(triedModels).join(', ')}`)
  }
  triedModels.add(modelKey)

  const systemPrompt = defaultAiConfig.systemPrompt ?? 'You are a helpful AI trading assistant.'
  
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history,
    { role: 'user' as const, content: message },
  ]

  try {
    const model = createModelClient(modelKey as Parameters<typeof createModelClient>[0])
    
    const { text, usage } = await generateText({
      model,
      messages,
      temperature: 0.4,
      maxOutputTokens: 2048,
    })

    // Calculate cost
    const modelConfig = defaultAiConfig.models[modelKey as keyof typeof defaultAiConfig.models]
    const inputTokens = (usage as { promptTokens?: number })?.promptTokens ?? 0
    const outputTokens = (usage as { completionTokens?: number })?.completionTokens ?? 0
    const totalTokens = inputTokens + outputTokens
    const costUsd = modelConfig
      ? (inputTokens / 1000) * modelConfig.costPer1kInputUsd +
        (outputTokens / 1000) * modelConfig.costPer1kOutputUsd
      : undefined

    return {
      content: text,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
    }
  } catch (error) {
    console.error(`[AI Chat] Model ${modelKey} failed:`, error instanceof Error ? error.message : error)
    
    // Try fallback model (only if we haven't exhausted all options)
    if (triedModels.size < 5) {
      const fallback = getFallbackModel(modelKey as Parameters<typeof getFallbackModel>[0])
      
      if (fallback && !triedModels.has(fallback.model)) {
        console.warn(`[AI Chat] Trying fallback ${fallback.model}`)
        return generateAiResponse(fallback.model, message, history, triedModels)
      }
    }

    throw error
  }
}

/**
 * POST /api/ai/chat/stream
 * Stream a chat response (SSE)
 */
export async function handleChatStream(c: Context) {
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

    if (!conversation) {
      const title = conversationStore.generateTitle(message)
      conversation = await conversationStore.createConversation(userId, {
        title,
        model,
      })
    }

    // Store user message
    await conversationStore.addMessage(conversation.id, {
      conversationId: conversation.id,
      role: 'user',
      content: message,
    })

    // Get conversation history
    const history = await conversationStore.getRecentContext(conversation.id)

    // Select model
    const selection = selectModel({
      preferredModel: model,
      taskType: taskType ?? 'chat',
      messageCount: history.length,
    })

    const systemPrompt = defaultAiConfig.systemPrompt ?? 'You are a helpful AI trading assistant.'
    const aiModel = createModelClient(selection.model as AiModelKey)

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: message },
    ]

    // Stream response
    const result = streamText({
      model: aiModel,
      messages,
      temperature: 0.4,
      maxOutputTokens: 2048,
    })

    // Set up SSE response
    c.header('Content-Type', 'text/event-stream')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')

    let fullContent = ''

    // Create readable stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        // Send conversation ID first
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId: conversation!.id, type: 'start' })}\n\n`))

        try {
          for await (const chunk of result.textStream) {
            fullContent += chunk
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk, type: 'content' })}\n\n`))
          }

          // Store complete response
          await conversationStore.addMessage(conversation!.id, {
            conversationId: conversation!.id,
            role: 'assistant',
            content: fullContent,
            model: selection.model,
          })

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.close()
        } catch (error) {
          console.error('[AI Chat Stream] Error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error', type: 'error' })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[AI Chat Stream] Error:', error)
    return c.json({ error: 'Failed to start stream' }, 500)
  }
}
