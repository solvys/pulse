/**
 * AI Streaming Functions
 * Streaming text generation with fallback support
 */

import { streamText, convertToModelMessages } from 'ai';
import { getModel } from './model-config.js';
import { getTools } from './tools.js';
import { buildSystemPrompt } from './firmware.js';

// UIMessage type definition (matches @ai-sdk/react UIMessage structure)
type UIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: Array<{ type: string; text?: string;[key: string]: any }>;
};

type FallbackModel = 'claude-opus-4' | 'grok-4' | 'grok-beta' | 'claude-sonnet-4.5' | 'llama-3-70b' | 'groq-llama-3-70b';

export async function createStreamingChatResponse(
  uiMessages: UIMessage[],
  modelName: string = 'grok-4',
  context?: string[],
  onFinish?: (text: string) => Promise<void>,
  enableTools: boolean = false
): Promise<Response> {
  // Fallback logic based on use case model hierarchy:
  // Claude Opus 4: Complex reasoning, QuickPulse (primary)
  // Groq Llama 3 70b: NTN reports, News interpretation
  // Grok 4: Complex reasoning fallback
  // Claude Sonnet 4.5: Autopilot trading, QuickPulse fallback
  const fallbackModels: FallbackModel[] =
    (modelName === 'claude-opus-4' || modelName === 'claude-opus-4-20250514')
      ? ['claude-opus-4', 'grok-beta', 'claude-sonnet-4.5'] // Complex reasoning fallbacks
      : (modelName === 'llama-3-70b' || modelName === 'groq-llama-3-70b')
        ? ['llama-3-70b', 'claude-sonnet-4.5', 'grok-beta'] // NTN/News fallbacks
        : (modelName === 'grok-4' || modelName === 'grok-beta')
          ? ['grok-beta', 'claude-opus-4', 'claude-sonnet-4.5']
          : (modelName === 'claude-sonnet-4.5' || modelName === 'claude-sonnet-4-5')
            ? ['claude-sonnet-4.5', 'claude-opus-4', 'grok-beta'] // Autopilot fallbacks
            : ['claude-opus-4', 'grok-beta', 'claude-sonnet-4.5']; // Default: Claude first

  const systemPrompt = buildSystemPrompt(context);

  // Convert UI messages to core messages (convertToCoreMessages expects messages with content property)
  const messagesForConversion = uiMessages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content || (msg.parts?.find(p => p.type === 'text')?.text || ''),
  }));

  const modelMessages = await convertToModelMessages(messagesForConversion as any);

  const messages = modelMessages.some((msg: any) => msg.role === 'system')
    ? modelMessages
    : [{ role: 'system' as const, content: systemPrompt }, ...modelMessages];

  let lastError: Error | null = null;
  for (const fallbackModel of fallbackModels) {
    try {
      const model = getModel(fallbackModel);

      const result = await streamText({
        model: model as any,
        messages,
        temperature: 0.7,
        // maxTokens removed - configured on model level in AI SDK v6
        tools: enableTools ? getTools() : undefined,
        onFinish: async ({ text }) => {
          if (onFinish) {
            await onFinish(text);
          }
        },
      });

      // Return UI message stream response (compatible with useChat)
      return result.toUIMessageStreamResponse();
    } catch (error: any) {
      console.error(`AI streaming error with ${fallbackModel}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (lastError) {
    console.error('All AI models failed:', lastError);
    throw new Error(lastError.message || 'Failed to create streaming response');
  }

  throw new Error('Failed to create streaming response');
}

export async function* streamAIResponse(
  prompt: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  modelName: string = 'grok-4',
  context?: string[]
): AsyncGenerator<string, void, unknown> {
  try {
    const model = getModel(modelName);
    const systemPrompt = buildSystemPrompt(context);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: prompt },
    ];

    const streamResult = await streamText({
      model: model as any,
      messages,
      temperature: 0.7,
      // maxTokens removed - configured on model level in AI SDK v6
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
