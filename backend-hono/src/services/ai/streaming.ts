/**
 * AI Streaming Functions
 * Streaming text generation with fallback support
 */

import { streamText, convertToCoreMessages } from 'ai';
import { getModel } from './model-config.js';

// UIMessage type definition (matches @ai-sdk/react UIMessage structure)
type UIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: Array<{ type: string; text?: string; [key: string]: any }>;
};

type FallbackModel = 'claude-opus-4' | 'grok-4' | 'claude-sonnet-4.5';

export async function createStreamingChatResponse(
  uiMessages: UIMessage[],
  modelName: string = 'grok-4',
  context?: string[],
  onFinish?: (text: string) => Promise<void>
): Promise<Response> {
  const fallbackModels: FallbackModel[] = 
    modelName === 'claude-opus-4' 
      ? ['claude-opus-4', 'grok-4', 'claude-sonnet-4.5']
      : modelName === 'grok-4'
      ? ['grok-4', 'claude-opus-4', 'claude-sonnet-4.5']
      : modelName === 'claude-sonnet-4.5'
      ? ['claude-sonnet-4.5', 'claude-opus-4', 'grok-4']
      : ['claude-opus-4', 'grok-4', 'claude-sonnet-4.5'];

  const systemPrompt = context
    ? `Context: ${context.join('\n')}\n\nYou are a trading assistant helping with analysis and coaching. Reference blind spots when relevant in E-VALS conversations.`
    : 'You are a trading assistant helping with analysis and coaching. Reference blind spots when relevant in E-VALS conversations.';

  // Convert UI messages to core messages (convertToCoreMessages expects messages with content property)
  const messagesForConversion = uiMessages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content || (msg.parts?.find(p => p.type === 'text')?.text || ''),
  }));
  
  const modelMessages = convertToCoreMessages(messagesForConversion as any);
  
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
        maxTokens: 2000,
        onFinish: async ({ text }) => {
          if (onFinish) {
            await onFinish(text);
          }
        },
      });

      // Return data stream response (compatible with useChat)
      return result.toDataStreamResponse();
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
    const systemPrompt = context
      ? `Context: ${context.join('\n')}\n\nYou are a trading assistant helping with analysis and coaching. Reference blind spots when relevant in E-VALS conversations.`
      : 'You are a trading assistant helping with analysis and coaching. Reference blind spots when relevant in E-VALS conversations.';

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: prompt },
    ];

    const streamResult = await streamText({
      model: model as any,
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
