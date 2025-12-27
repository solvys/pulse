/**
 * AI Service
 * Handles Vercel AI SDK integration, model initialization, and streaming responses
 */

import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { xai } from '@ai-sdk/xai';
import { createGateway } from '@ai-sdk/gateway';
import { env } from '../env.js';
import type { ChatRequest, ChatResponse } from '../types/ai.js';

// Model configurations
const GROK_4_MODEL = 'grok-4';
const GROK_VISION_MODEL = 'grok-2-1212';
const CLAUDE_OPUS_4_5_MODEL = 'claude-opus-4-20250514';
const CLAUDE_SONNET_4_5_MODEL = 'claude-3-5-sonnet-20241022';

// Initialize Vercel AI Gateway if API key is provided
let gateway: ReturnType<typeof createGateway> | null = null;
if (env.VERCEL_AI_GATEWAY_API_KEY) {
  gateway = createGateway({
    apiKey: env.VERCEL_AI_GATEWAY_API_KEY,
  });
}

/**
 * Get AI model instance based on model name
 * Uses Vercel AI Gateway if configured, otherwise falls back to direct provider keys
 */
function getModel(modelName: string = 'grok-4') {
  // If using Vercel AI Gateway, route through gateway
  if (gateway) {
    switch (modelName) {
      case 'claude-opus-4':
      case 'claude-opus-4-20250514':
        // Vercel AI Gateway format: provider/model-name
        return gateway(`anthropic/${CLAUDE_OPUS_4_5_MODEL}`);
      case 'claude-sonnet-4.5':
      case 'claude-sonnet-4-5':
      case 'claude-3-5-sonnet-20241022':
        // Vercel AI Gateway format: provider/model-name
        return gateway(`anthropic/${CLAUDE_SONNET_4_5_MODEL}`);
      case 'grok-4':
      default:
        // Vercel AI Gateway format: provider/model-name
        return gateway(`xai/${GROK_4_MODEL}`);
    }
  }

  // Fallback to direct provider keys
  switch (modelName) {
    case 'claude-opus-4':
    case 'claude-opus-4-20250514':
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured. Either set VERCEL_AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY');
      }
      return anthropic(CLAUDE_OPUS_4_5_MODEL);
    case 'claude-sonnet-4.5':
    case 'claude-sonnet-4-5':
    case 'claude-3-5-sonnet-20241022':
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured. Either set VERCEL_AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY');
      }
      return anthropic(CLAUDE_SONNET_4_5_MODEL);
    case 'grok-4':
    default:
      if (!env.XAI_API_KEY) {
        throw new Error('XAI_API_KEY not configured. Either set VERCEL_AI_GATEWAY_API_KEY or XAI_API_KEY');
      }
      return xai(GROK_4_MODEL);
  }
}

/**
 * Get vision model for image analysis
 */
function getVisionModel() {
  // If using Vercel AI Gateway, route through gateway
  if (gateway) {
    return gateway(`xai/${GROK_VISION_MODEL}`);
  }

  // Fallback to direct provider key
  if (!env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY not configured. Either set VERCEL_AI_GATEWAY_API_KEY or XAI_API_KEY');
  }
  return xai(GROK_VISION_MODEL);
}

/**
 * Generate text response (non-streaming)
 */
export async function generateAIResponse(
  prompt: string,
  modelName: string = 'grok-4',
  context?: string[]
): Promise<string> {
  try {
    const model = getModel(modelName);
    const systemPrompt = context
      ? `Context: ${context.join('\n')}\n\nYou are a trading assistant helping with analysis and coaching.`
      : 'You are a trading assistant helping with analysis and coaching.';

    const { text } = await generateText({
      model: model as any, // Type assertion for compatibility between gateway and direct provider models
      prompt: `${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`,
      temperature: 0.7,
      maxTokens: 2000,
    });

    return text;
  } catch (error) {
    console.error('AI generation error:', error);
    // Return fallback response instead of throwing
    return "I'm having trouble processing that right now. Please try again.";
  }
}

/**
 * Stream text response for chat
 */
export async function* streamAIResponse(
  prompt: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  modelName: string = 'grok-4',
  context?: string[]
): AsyncGenerator<string, void, unknown> {
  try {
    const model = getModel(modelName);
    const systemPrompt = context
      ? `Context: ${context.join('\n')}\n\nYou are a trading assistant helping with analysis and coaching. Reference blind spots when relevant in E-VALS conversations.`
      : 'You are a trading assistant helping with analysis and coaching. Reference blind spots when relevant in E-VALS conversations.';

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: prompt },
    ];

    const streamResult = await streamText({
      model: model as any, // Type assertion for compatibility between gateway and direct provider models
      messages,
      temperature: 0.7,
      maxTokens: 2000,
    });
    const { textStream } = streamResult;

    for await (const chunk of textStream) {
      yield chunk;
    }
  } catch (error) {
    console.error('AI streaming error:', error);
    throw new Error('Failed to stream AI response');
  }
}

/**
 * Analyze image (for Quick Pulse screenshot analysis)
 */
export async function analyzeImage(
  imageData: Buffer | string,
  prompt: string,
  marketContext?: string
): Promise<string> {
  try {
    const model = getVisionModel();
    const fullPrompt = marketContext
      ? `${prompt}\n\nMarket Context: ${marketContext}`
      : prompt;

    const { text } = await generateText({
      model: model as any, // Type assertion for compatibility
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: fullPrompt },
            {
              type: 'image',
              image: imageData,
            },
          ],
        },
      ],
      temperature: 0.7,
      maxTokens: 2000,
    });

    return text;
  } catch (error) {
    console.error('Image analysis error:', error);
    throw new Error('Failed to analyze image');
  }
}

/**
 * Generate threat analysis using Claude Opus 4.5
 */
export async function generateThreatAnalysis(
  threatData: string,
  tradingHistory: string
): Promise<{ summary: string; patterns: string[]; recommendations: string[] }> {
  try {
    const model = getModel('claude-opus-4-20250514');

    const prompt = `Analyze the following trading threat data and provide insights:

Threat Data:
${threatData}

Trading History Context:
${tradingHistory}

Provide:
1. A summary of the threat patterns
2. Identified patterns (list)
3. Actionable recommendations (list)

Format as JSON with keys: summary, patterns (array), recommendations (array).`;

    const { text } = await generateText({
      model: model as any, // Type assertion for compatibility
      prompt,
      temperature: 0.5,
      maxTokens: 1500,
    });

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(text);
      return {
        summary: parsed.summary || text,
        patterns: parsed.patterns || [],
        recommendations: parsed.recommendations || [],
      };
    } catch {
      // If not JSON, return as summary
      return {
        summary: text,
        patterns: [],
        recommendations: [],
      };
    }
  } catch (error) {
    console.error('Threat analysis error:', error);
    throw new Error('Failed to generate threat analysis');
  }
}

/**
 * Generate quick pulse analysis
 */
export async function generateQuickPulseAnalysis(
  ivScore: number,
  vix: number,
  marketData?: any,
  screenshotAnalysis?: string
): Promise<string> {
  try {
    const model = getModel('grok-4');

    const prompt = `Provide a quick pulse analysis of the current market state:

IV Score: ${ivScore}/10
VIX Level: ${vix}
${marketData ? `Market Data: ${JSON.stringify(marketData)}` : ''}
${screenshotAnalysis ? `Screenshot Analysis: ${screenshotAnalysis}` : ''}

Provide a concise summary (2-3 sentences) with:
1. Current market state assessment
2. Trading opportunity level
3. Key risk factors or recommendations`;

    const { text } = await generateText({
      model: model as any, // Type assertion for compatibility
      prompt,
      temperature: 0.7,
      maxTokens: 500,
    });

    return text;
  } catch (error) {
    console.error('Quick pulse analysis error:', error);
    throw new Error('Failed to generate quick pulse analysis');
  }
}
