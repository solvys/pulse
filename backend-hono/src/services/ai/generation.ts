/**
 * AI Generation Functions
 * Non-streaming text generation
 */

import { generateText } from 'ai';
import { getModel } from './model-config.js';
import { buildSystemPrompt, AI_PRICE_QUICK_ANALYSIS, AI_PRICE_THREAT_ANALYSIS } from './firmware.js';

export async function generateAIResponse(
  prompt: string,
  modelName: string = 'grok-4',
  context?: string[]
): Promise<string> {
  try {
    const model = getModel(modelName);
    const systemPrompt = buildSystemPrompt(context);

    const { text } = await generateText({
      model: model as any,
      prompt: `${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`,
      temperature: 0.7,
      maxTokens: 2000 as any,
    });

    return text;
  } catch (error) {
    console.error('AI generation error:', error);
    return "I'm having trouble processing that right now. Please try again.";
  }
}

export async function generateQuickPulseAnalysis(
  ivScore: number,
  vix: number,
  additionalContext?: Record<string, any>,
  screenshotAnalysis?: string
): Promise<string> {
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
      model: model as any,
      prompt,
      temperature: 0.7,
      maxTokens: 500,
    });

    return text;
  } catch (error) {
    console.error('Quick pulse analysis error:', error);
    return 'Unable to generate market analysis at this time.';
  }
}

export async function generateThreatAnalysis(
  threatData: string,
  tradingHistory: string
): Promise<string> {
  try {
    const model = getModel('claude-opus-4-20250514');
    const prompt = `Analyze the following trading threat data and provide insights:

Threat Data:
${threatData}

Trading History Context:
${tradingHistory}

Provide insights on patterns, risks, and recommendations.`;

    const { text } = await generateText({
      model: model as any,
      prompt,
      temperature: 0.5,
      maxTokens: 1500,
    });

    return text;
  } catch (error) {
    console.error('Threat analysis error:', error);
    return 'Unable to analyze threats at this time.';
  }
}
