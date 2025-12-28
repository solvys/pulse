/**
 * AI Route Schemas
 * Validation schemas for AI API endpoints
 */

import { z } from 'zod';

export const scoreRequestSchema = z.object({
  symbol: z.string().optional(),
  instrument: z.string().optional(),
});

export const historySchema = z.object({
  symbol: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(100),
  offset: z.coerce.number().min(0).default(0),
});

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    id: z.string().optional(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    parts: z.array(z.any()).optional(),
  })),
  conversationId: z.string().optional(),
  model: z.enum(['grok-4', 'claude-opus-4', 'claude-sonnet-4.5']).optional(),
});

export const conversationRequestSchema = z.object({
  title: z.string().optional(),
});

export const threatAnalyzeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeAnalysis: z.boolean().optional(),
});

export const blindSpotSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
});
