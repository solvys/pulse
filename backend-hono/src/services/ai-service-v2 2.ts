
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import { env } from '../env.js';

// Initialize OpenRouter provider
// detailed documentation: https://sdk.vercel.ai/providers/openai
const openRouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY,
});

// Model definitions
const MODELS = {
    // Vision / Complex Reasoning - User requested Gemini Pro or Claude Opus
    // Using Gemini Pro 1.5 as "GeminiPro3" equivalent for deep reasoning
    BRAIN: openRouter('google/gemini-pro-1.5') as any,
    // Fast Logic / Chat
    FAST: openRouter('meta-llama/llama-3.3-70b-instruct') as any,
};

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export class AIService {

    /**
     * Stream a chat response from the Brain
     */
    async streamChat(messages: ChatMessage[], systemContext: string, onFinish?: (text: string) => Promise<void>) {
        try {
            const result = await streamText({
                model: MODELS.BRAIN,
                messages,
                system: systemContext,
                temperature: 0.7,
                onFinish: async (event) => {
                    if (onFinish && event.text) {
                        await onFinish(event.text);
                    }
                }
            });
            return result.toUIMessageStreamResponse();
        } catch (error) {
            console.error('AI Stream Error:', error);
            throw error;
        }
    }

    /**
     * Analyze an image for Quick Pulse
     */
    async analyzeImage(imageBase64: string, prompt: string, context: string) {
        try {
            const { text } = await generateText({
                model: MODELS.BRAIN,
                messages: [
                    {
                        role: 'system',
                        content: context
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'image', image: imageBase64 }
                        ]
                    }
                ],
                temperature: 0.2, // Low temp for analytical precision
            });
            return text;
        } catch (error) {
            console.error('AI Vision Error:', error);
            throw error;
        }
    }
}

export const aiService = new AIService();
