/**
 * AI Generation Functions
 * Non-streaming text generation
 */
export declare function generateAIResponse(prompt: string, modelName?: string, context?: string[]): Promise<string>;
export declare function generateQuickPulseAnalysis(ivScore: number, vix: number, additionalContext?: Record<string, any>, screenshotAnalysis?: string): Promise<string>;
export declare function generateThreatAnalysis(threatData: string, tradingHistory: string): Promise<string>;
//# sourceMappingURL=generation.d.ts.map