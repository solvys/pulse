import { z } from 'zod'
import { defaultAiConfig, type AiConfig, type AiModelKey } from '../config/ai-config'
import { createAiModelService, type AiMessage, type StreamFinish } from './ai-model-service'
import { createConversationManager } from './conversation-manager'

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1)
})

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  conversationId: z.string().optional(),
  model: z.enum(['opus', 'haiku', 'grok']).optional(),
  taskType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  stream: z.boolean().optional()
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

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
    return parsed.data
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
    const request = parseChatRequest(rawBody)
    const normalizedMessages = normalizeMessages(request.messages)
    if (!normalizedMessages.length) {
      throw new Error('Chat request is missing messages')
    }

    const lastUserMessage = getLastUserMessage(normalizedMessages)
    if (!lastUserMessage) {
      throw new Error('Chat request must include a user message')
    }

    const conversation = await ensureConversation(userId, request, lastUserMessage)
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
    }

    if (!shouldStream(request, acceptHeader)) {
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

    return {
      type: 'stream',
      response,
      conversationId: conversation.id,
      model: streamResult.model
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
