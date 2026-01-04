import { z } from 'zod'
import { defaultAiConfig, type AiConfig, type AiModelKey } from '../config/ai-config'
import { createAiModelService, type AiMessage, type StreamFinish } from './ai-model-service'
import { createConversationManager, type ConversationRecord } from './conversation-manager'

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1)
})

const rawModelSchema = z.enum(['sonnet', 'grok', 'groq', 'opus', 'haiku'])

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  conversationId: z.string().optional(),
  model: rawModelSchema.optional(),
  taskType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  stream: z.boolean().optional()
})

type RawChatRequest = z.infer<typeof chatRequestSchema>

export type ChatRequest = Omit<RawChatRequest, 'model'> & { model?: AiModelKey }

export interface ChatStreamResult {
  type: 'stream'
  response: Response
  conversationId: string
  model: AiModelKey
}

export interface ChatJsonResult {
  type: 'json'
  body: { message: string; conversationId: string; model: AiModelKey }
}

export type ChatResult = ChatStreamResult | ChatJsonResult

const isUuid = (value?: string) => {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

const isValidRole = (role: unknown): role is AiMessage['role'] =>
  role === 'system' || role === 'user' || role === 'assistant'

const normalizeMessages = (messages: ChatRequest['messages']): AiMessage[] =>
  messages.map((message, index) => {
    const content = message.content.trim()
    if (!content) {
      throw new Error(`Message at index ${index} cannot be empty or whitespace only`)
    }
    return {
      role: message.role,
      content
    }
  })

const trimMessages = (messages: AiMessage[], maxMessages: number): AiMessage[] => {
  if (maxMessages <= 0) return []
  if (messages.length <= maxMessages) return messages

  const systemIndexes = messages.reduce<number[]>((acc, message, index) => {
    if (message.role === 'system') acc.push(index)
    return acc
  }, [])

  if (systemIndexes.length >= maxMessages) {
    const keep = systemIndexes.slice(-maxMessages)
    return keep.map((index) => messages[index])
  }

  const indexesToKeep = new Set(systemIndexes)
  let remaining = maxMessages - systemIndexes.length

  for (let i = messages.length - 1; i >= 0 && remaining > 0; i -= 1) {
    if (indexesToKeep.has(i)) continue
    indexesToKeep.add(i)
    remaining -= 1
  }

  return messages.filter((_, index) => indexesToKeep.has(index))
}

const getLastUserMessage = (messages: AiMessage[]) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i]
  }
  return null
}

const buildTitle = (content: string) => {
  const cleaned = content.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'New conversation'
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned
}

const shouldStream = (request: ChatRequest, acceptHeader?: string | null) => {
  if (typeof request.stream === 'boolean') return request.stream
  if (!acceptHeader) return true
  if (acceptHeader.includes('text/event-stream')) return true
  return !acceptHeader.includes('application/json')
}

const normalizePreferredModel = (model?: RawChatRequest['model']): AiModelKey | undefined => {
  if (!model) return undefined
  if (model === 'opus') return 'sonnet'
  if (model === 'haiku') return 'groq'
  return model
}

const buildFallbackMessage = () =>
  [
    "Price (failsafe): I'm still booting up the reasoning stack.",
    "Make sure the backend has valid AI credentials (e.g., VERCEL_AI_GATEWAY_API_KEY / AI_SYSTEM_PROMPT) and try again.",
    "Until then I'll acknowledge your message, but I can't run full workflows yet."
  ].join(' ')

const isConversationStale = (conversation: ConversationRecord) => {
  if (!conversation.staleAt) return false
  return new Date(conversation.staleAt).getTime() <= Date.now()
}

export const createChatService = (deps: {
  config?: AiConfig
  modelService?: ReturnType<typeof createAiModelService>
  conversationManager?: ReturnType<typeof createConversationManager>
} = {}) => {
  const config = deps.config ?? defaultAiConfig
  const modelService = deps.modelService ?? createAiModelService(config)
  const conversationManager = deps.conversationManager ?? createConversationManager(config)

  const parseChatRequest = (body: unknown): ChatRequest => {
    const parsed = chatRequestSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join(', ')
      throw new Error(`Invalid chat request: ${message}`)
    }
    const { model, ...rest } = parsed.data
    return { ...rest, model: normalizePreferredModel(model) }
  }

  const ensureConversation = async (
    userId: string,
    request: ChatRequest,
    message: AiMessage
  ) => {
    const conversationId = isUuid(request.conversationId) ? request.conversationId : undefined
    if (conversationId) {
      const existing = await conversationManager.getConversation(userId, conversationId)
      if (existing) {
        return existing
      }
      throw new Error(`Conversation ${conversationId} was not found`)
    }

    const metadata = request.metadata ?? null
    const parentId = isUuid(String(metadata?.parentId ?? '')) ? String(metadata?.parentId) : null
    const threadId = isUuid(String(metadata?.threadId ?? '')) ? String(metadata?.threadId) : null

    return conversationManager.createConversation({
      userId,
      title: buildTitle(message.content),
      model: request.model ?? null,
      metadata,
      parentId,
      threadId
    })
  }

  const buildPromptMessages = async (
    conversationId: string | null,
    incomingMessages: AiMessage[]
  ): Promise<AiMessage[]> => {
    if (incomingMessages.length) return incomingMessages
    if (!conversationId) return []
    const stored = await conversationManager.getConversationMessages(conversationId)
    return stored.map((message, index) => {
      if (!isValidRole(message.role)) {
        throw new Error(
          `Conversation ${conversationId} contains message ${index} with invalid role ${message.role}`
        )
      }
      return {
        role: message.role,
        content: message.content
      }
    })
  }

  const handleChat = async (
    userId: string,
    rawBody: unknown,
    acceptHeader?: string | null
  ): Promise<ChatResult> => {
    const startedAt = Date.now()
    const request = parseChatRequest(rawBody)
    const normalizedMessages = normalizeMessages(request.messages)
    if (!normalizedMessages.length) {
      throw new Error('Chat request is missing messages')
    }

    const lastUserMessage = getLastUserMessage(normalizedMessages)
    if (!lastUserMessage) {
      throw new Error('Chat request must include a user message')
    }

    const wantsStream = shouldStream(request, acceptHeader)
    console.info('[chat] request', {
      userId,
      providedConversationId: request.conversationId ?? null,
      messageCount: normalizedMessages.length,
      lastUserChars: lastUserMessage.content.length,
      stream: wantsStream,
      accept: acceptHeader ?? null,
      modelHint: request.model ?? null,
      taskType: request.taskType ?? (request.metadata?.taskType as string | undefined) ?? null
    })

    const conversation = await ensureConversation(userId, request, lastUserMessage)
    if (conversation.isArchived) {
      const error = new Error('Conversation is archived') as Error & { status?: number; code?: string }
      error.status = 409
      error.code = 'conversation_archived'
      throw error
    }

    if (isConversationStale(conversation)) {
      const error = new Error('Conversation is stale') as Error & {
        status?: number
        code?: string
        metadata?: Record<string, unknown>
      }
      error.status = 409
      error.code = 'conversation_stale'
      error.metadata = { staleAt: conversation.staleAt }
      throw error
    }
    const promptMessages = await buildPromptMessages(conversation.id, normalizedMessages)
    const withSystem =
      config.systemPrompt && !promptMessages.some((message) => message.role === 'system')
        ? [{ role: 'system', content: config.systemPrompt }, ...promptMessages]
        : promptMessages
    const trimmedMessages = trimMessages(withSystem, config.conversation.maxHistoryMessages)

    const selection = modelService.selectModel({
      preferredModel: request.model,
      taskType: request.taskType ?? (request.metadata?.taskType as string | undefined),
      messageCount: trimmedMessages.length,
      inputChars: lastUserMessage.content.length
    })

    await conversationManager.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: lastUserMessage.content,
      metadata: request.metadata ?? null
    })

    const onFinish = async (finish: StreamFinish) => {
      try {
        await conversationManager.addMessage({
          conversationId: conversation.id,
          role: 'assistant',
          content: finish.text,
          metadata: {
            finishReason: finish.finishReason,
            latencyMs: finish.latencyMs
          },
          model: finish.model,
          inputTokens: finish.usage?.inputTokens ?? null,
          outputTokens: finish.usage?.outputTokens ?? null,
          totalTokens: finish.usage?.totalTokens ?? null,
          costUsd: finish.costUsd ?? null
        })
      } catch (error) {
        console.error('[chat] failed to persist assistant message', {
          userId,
          conversationId: conversation.id,
          model: finish.model,
          messageChars: finish.text.length,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    console.info('[chat] model selected', {
      userId,
      conversationId: conversation.id,
      model: selection.model,
      reason: selection.reason,
      trimmedMessages: trimmedMessages.length,
      staleAt: conversation.staleAt ?? null
    })

    const respondWithFallback = async (error: unknown) => {
      const fallbackMessage = buildFallbackMessage()
      await conversationManager.addMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: fallbackMessage,
        metadata: {
          fallback: true,
          error: error instanceof Error ? error.message : String(error)
        },
        model: selection.model,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        costUsd: null
      })
      return {
        type: 'json',
        body: {
          message: fallbackMessage,
          conversationId: conversation.id,
          model: selection.model
        }
      }
    }

    try {
      if (!wantsStream) {
        const result = await modelService.generateChat({
          model: selection.model,
          messages: trimmedMessages
        })

        await onFinish({
          text: result.text,
          model: result.model,
          usage: result.usage,
          finishReason: 'stop',
          costUsd: result.costUsd,
          latencyMs: result.latencyMs
        })

        console.info('[chat] completed (json)', {
          userId,
          conversationId: conversation.id,
          model: result.model,
          latencyMs: Date.now() - startedAt
        })

        return {
          type: 'json',
          body: {
            message: result.text,
            conversationId: conversation.id,
            model: result.model
          }
        }
      }

      const streamResult = await modelService.streamChat({
        model: selection.model,
        messages: trimmedMessages,
        onFinish
      })

      const response = streamResult.result.toDataStreamResponse({
        headers: {
          'X-Conversation-Id': conversation.id,
          'X-Model': streamResult.model
        }
      })

      console.info('[chat] started stream', {
        userId,
        conversationId: conversation.id,
        model: streamResult.model,
        latencyMs: Date.now() - startedAt
      })

      return {
        type: 'stream',
        response,
        conversationId: conversation.id,
        model: streamResult.model
      }
    } catch (error) {
      console.error('[chat] generation failed', {
        userId,
        conversationId: conversation.id,
        message: error instanceof Error ? error.message : String(error)
      })
      return respondWithFallback(error)
    }
  }

  const listConversations = async (userId: string, options?: { limit?: number; offset?: number }) =>
    conversationManager.listConversations(userId, options)

  const getConversation = async (userId: string, conversationId: string) => {
    const conversation = await conversationManager.getConversation(userId, conversationId)
    if (!conversation) return null
    const messages = await conversationManager.getConversationMessages(conversationId)
    return { conversation, messages }
  }

  return {
    handleChat,
    listConversations,
    getConversation
  }
}
