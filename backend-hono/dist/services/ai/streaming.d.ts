/**
 * AI Streaming Functions
 * Streaming text generation with fallback support
 */
type UIMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    parts?: Array<{
        type: string;
        text?: string;
        [key: string]: any;
    }>;
};
export declare function createStreamingChatResponse(uiMessages: UIMessage[], modelName?: string, context?: string[], onFinish?: (text: string) => Promise<void>, enableTools?: boolean): Promise<Response>;
export declare function streamAIResponse(prompt: string, conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
}>, modelName?: string, context?: string[]): AsyncGenerator<string, void, unknown>;
export {};
//# sourceMappingURL=streaming.d.ts.map