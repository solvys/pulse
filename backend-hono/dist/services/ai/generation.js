/**
 * AI Generation Functions
 * Non-streaming text generation
 */
import { generateText } from 'ai';
import { getModel } from './model-config.js';
import { buildSystemPrompt } from './firmware.js';
const telemetryOptions = {
    experimental_telemetry: {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
    },
};
export async function generateAIResponse(prompt, modelName = 'grok-4', context) {
    try {
        const model = getModel(modelName);
        const systemPrompt = buildSystemPrompt(context);
        const { text } = await generateText({
            model: model,
            prompt: `${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`,
            temperature: 0.7,
            // maxTokens removed - configured on model level in AI SDK v6
            ...telemetryOptions,
        });
        return text;
    }
    catch (error) {
        console.error('AI generation error:', error);
        return "I'm having trouble processing that right now. Please try again.";
    }
}
export async function generateQuickPulseAnalysis(ivScore, vix, additionalContext, screenshotAnalysis) {
    try {
        const model = getModel('grok-4');
        const contextParts = [
            `Current IV Score: ${ivScore}/10`,
            `Current VIX: ${vix}`,
        ];
        if (additionalContext) {
            contextParts.push(`Additional Context: ${JSON.stringify(additionalContext)}`);
        }
        if (screenshotAnalysis) {
            contextParts.push(`Screenshot Analysis: ${screenshotAnalysis}`);
        }
        const prompt = `Analyze the current market state based on:
${contextParts.join('\n')}

Provide a concise market analysis focusing on volatility, risk, and trading opportunities.`;
        const { text } = await generateText({
            model: model,
            prompt,
            temperature: 0.7,
            // maxTokens removed - configured on model level in AI SDK v6
            ...telemetryOptions,
        });
        return text;
    }
    catch (error) {
        console.error('Quick pulse analysis error:', error);
        return 'Unable to generate market analysis at this time.';
    }
}
export async function generateThreatAnalysis(threatData, tradingHistory) {
    try {
        const model = getModel('claude-opus-4-20250514');
        const prompt = `Analyze the following trading threat data and provide insights:

Threat Data:
${threatData}

Trading History Context:
${tradingHistory}

Provide insights on patterns, risks, and recommendations.`;
        const { text } = await generateText({
            model: model,
            prompt,
            temperature: 0.5,
            // maxTokens removed - configured on model level in AI SDK v6
            ...telemetryOptions,
        });
        return text;
    }
    catch (error) {
        console.error('Threat analysis error:', error);
        return 'Unable to analyze threats at this time.';
    }
}
//# sourceMappingURL=generation.js.map