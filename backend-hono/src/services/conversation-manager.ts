import { DatabaseError, query } from '../db/optimized'
import { defaultAiConfig, type AiConfig } from '../config/ai-config'

export interface ConversationRecord {
  id: string
  userId: string
  title: string | null
  model: string | null
  threadId: string | null
  parentId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  lastMessage?: string | null
  lastMessageAt?: string | null
}

export interface MessageRecord {
  id: string
  conversationId: string
  role: string
  content: string
  metadata: Record<string, unknown> | null
  model: string | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  costUsd: number | null
  createdAt: string
}

export interface CreateConversationInput {
  userId: string
  title?: string | null
  model?: string | null
  metadata?: Record<string, unknown> | null
  parentId?: string | null
  threadId?: string | null
}

export interface AddMessageInput {
  conversationId: string
  role: string
  content: string
  metadata?: Record<string, unknown> | null
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
  costUsd?: number | null
}

const normalizeMetadata = (metadata?: Record<string, unknown> | null) => metadata ?? null

const mapConversation = (row: Record<string, unknown>): ConversationRecord => ({
  id: String(row.id),
  userId: String(row.user_id),
  title: row.title ? String(row.title) : null,
  model: row.model ? String(row.model) : null,
  threadId: row.thread_id ? String(row.thread_id) : null,
  parentId: row.parent_id ? String(row.parent_id) : null,
  metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
  lastMessage: row.last_message ? String(row.last_message) : null,
  lastMessageAt: row.last_message_at ? String(row.last_message_at) : null
})

const mapMessage = (row: Record<string, unknown>): MessageRecord => ({
  id: String(row.id),
  conversationId: String(row.conversation_id),
  role: String(row.role),
  content: String(row.content),
  metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  model: row.model ? String(row.model) : null,
  inputTokens: row.input_tokens !== null && row.input_tokens !== undefined ? Number(row.input_tokens) : null,
  outputTokens: row.output_tokens !== null && row.output_tokens !== undefined ? Number(row.output_tokens) : null,
  totalTokens: row.total_tokens !== null && row.total_tokens !== undefined ? Number(row.total_tokens) : null,
  costUsd: row.cost_usd !== null && row.cost_usd !== undefined ? Number(row.cost_usd) : null,
  createdAt: String(row.created_at)
})

export const createConversationManager = (config: AiConfig = defaultAiConfig) => {
  const mapDbErrorStatus = (error: DatabaseError) => {
    // Postgres SQLSTATE codes:
    // 23503: foreign_key_violation, 23505: unique_violation
    if (error.code === '23503') return 400
    if (error.code === '23505') return 409
    return error.status
  }

  const wrapDbError = (error: unknown, message: string) => {
    if (error instanceof DatabaseError) {
      throw new DatabaseError(message, {
        status: mapDbErrorStatus(error),
        code: error.code,
        cause: error
      })
    }
    throw error
  }

  const createConversation = async (input: CreateConversationInput): Promise<ConversationRecord> => {
    let result
    try {
      result = await query(
        `
        INSERT INTO ai_conversations (user_id, title, model, metadata, parent_id, thread_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          input.userId,
          input.title ?? null,
          input.model ?? null,
          normalizeMetadata(input.metadata),
          input.parentId ?? null,
          input.threadId ?? input.parentId ?? null
        ]
      )
    } catch (error) {
      wrapDbError(error, 'Failed to create conversation')
    }

    const conversation = mapConversation(result.rows[0] as Record<string, unknown>)
    if (!conversation.threadId) {
      try {
        await query(`UPDATE ai_conversations SET thread_id = $1 WHERE id = $2`, [
          conversation.id,
          conversation.id
        ])
      } catch (error) {
        wrapDbError(error, 'Failed to finalize conversation thread id')
      }
      conversation.threadId = conversation.id
    }
    return conversation
  }

  const getConversation = async (userId: string, conversationId: string): Promise<ConversationRecord | null> => {
    let result
    try {
      result = await query(
        `
        SELECT c.*,
          m.content AS last_message,
          m.created_at AS last_message_at
        FROM ai_conversations c
        LEFT JOIN LATERAL (
          SELECT content, created_at
          FROM ai_messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON TRUE
        WHERE c.id = $1 AND c.user_id = $2
        LIMIT 1
        `,
        [conversationId, userId]
      )
    } catch (error) {
      wrapDbError(error, 'Failed to load conversation')
    }
    if (!result.rows.length) return null
    return mapConversation(result.rows[0] as Record<string, unknown>)
  }

  const listConversations = async (
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ConversationRecord[]> => {
    const limit = Math.min(options.limit ?? 50, 100)
    const offset = options.offset ?? 0
    let result
    try {
      result = await query(
        `
        SELECT c.*,
          m.content AS last_message,
          m.created_at AS last_message_at
        FROM ai_conversations c
        LEFT JOIN LATERAL (
          SELECT content, created_at
          FROM ai_messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON TRUE
        WHERE c.user_id = $1
        ORDER BY c.updated_at DESC
        LIMIT $2 OFFSET $3
        `,
        [userId, limit, offset]
      )
    } catch (error) {
      wrapDbError(error, 'Failed to list conversations')
    }

    return result.rows.map((row) => mapConversation(row as Record<string, unknown>))
  }

  const getConversationMessages = async (
    conversationId: string,
    options: { limit?: number } = {}
  ): Promise<MessageRecord[]> => {
    const limit = Math.min(options.limit ?? config.conversation.maxHistoryMessages, 200)
    let result
    try {
      result = await query(
        `
        SELECT *
        FROM ai_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        LIMIT $2
        `,
        [conversationId, limit]
      )
    } catch (error) {
      wrapDbError(error, 'Failed to load conversation messages')
    }
    return result.rows.map((row) => mapMessage(row as Record<string, unknown>))
  }

  const addMessage = async (input: AddMessageInput): Promise<MessageRecord> => {
    let result
    try {
      result = await query(
        `
        INSERT INTO ai_messages (
          conversation_id,
          role,
          content,
          metadata,
          model,
          input_tokens,
          output_tokens,
          total_tokens,
          cost_usd
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          input.conversationId,
          input.role,
          input.content,
          normalizeMetadata(input.metadata),
          input.model ?? null,
          input.inputTokens ?? null,
          input.outputTokens ?? null,
          input.totalTokens ?? null,
          input.costUsd ?? null
        ]
      )
    } catch (error) {
      wrapDbError(error, 'Failed to save message')
    }

    try {
      await query(
        `
        UPDATE ai_conversations
        SET updated_at = NOW(),
            model = COALESCE($2, model)
        WHERE id = $1
        `,
        [input.conversationId, input.model ?? null]
      )
    } catch (error) {
      wrapDbError(error, 'Failed to update conversation metadata')
    }

    return mapMessage(result.rows[0] as Record<string, unknown>)
  }

  const updateConversation = async (
    conversationId: string,
    updates: { title?: string | null; metadata?: Record<string, unknown> | null }
  ) => {
    try {
      await query(
        `
        UPDATE ai_conversations
        SET title = COALESCE($2, title),
            metadata = COALESCE($3, metadata),
            updated_at = NOW()
        WHERE id = $1
        `,
        [conversationId, updates.title ?? null, normalizeMetadata(updates.metadata)]
      )
    } catch (error) {
      wrapDbError(error, 'Failed to update conversation')
    }
  }

  return {
    createConversation,
    getConversation,
    listConversations,
    getConversationMessages,
    addMessage,
    updateConversation
  }
}
