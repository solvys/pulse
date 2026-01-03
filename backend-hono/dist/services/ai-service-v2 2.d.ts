interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export declare class AIService {
    /**
     * Stream a chat response from the Brain
     */
    streamChat(messages: ChatMessage[], systemContext: string, onFinish?: (text: string) => Promise<void>): Promise<Response>;
    /**
     * Analyze an image for Quick Pulse
     */
    analyzeImage(imageBase64: string, prompt: string, context: string): Promise<string>;
}
export declare const aiService: AIService;
export {};
//# sourceMappingURL=ai-service-v2%202.d.ts.map