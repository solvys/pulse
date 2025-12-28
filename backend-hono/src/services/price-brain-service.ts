/**
 * Price Brain Layer Service
 * Agentic AI features via AI Gateway for news scoring
 */

import { generateText } from 'ai';
import { getModel } from './ai/model-config.js';

export interface PriceBrainScore {
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  classification: 'Cyclical' | 'Counter-cyclical' | 'Neutral';
  impliedPoints: number | null; // Only for Level 3 and 4, null for Level 1/2
  instrument: string | null; // User-selected instrument symbol
  confidence: number; // 0-1 confidence score
}

export interface NewsItemForScoring {
  title: string;
  content: string;
  macroLevel: 1 | 2 | 3 | 4;
  source?: string;
  symbols?: string[];
}

/**
 * Score news item using Price Brain Layer (AI Gateway)
 */
export async function scoreNewsWithPriceBrain(
  newsItem: NewsItemForScoring,
  userInstrument?: string
): Promise<PriceBrainScore> {
  try {
    const model = getModel('grok-4'); // Use Grok-4 via AI Gateway
    
    const systemPrompt = `You are the Price Brain Layer, an expert trading AI that analyzes macroeconomic news and market events. Your task is to score news items for trading impact.

Analyze the following news item and provide:
1. Sentiment: "Bullish", "Bearish", or "Neutral" - how the news affects market direction
2. Classification: "Cyclical" (earnings, corporate events) or "Counter-cyclical" (Fed, economic policy, geopolitical) or "Neutral"
3. Implied Points: ONLY if macroLevel is 3 or 4, estimate how many points this would move the ${userInstrument || 'market'} instrument. Return a number (positive for bullish, negative for bearish). If macroLevel is 1 or 2, return null.
4. Confidence: A number between 0 and 1 indicating your confidence in the analysis

Return your response as a JSON object with this exact structure:
{
  "sentiment": "Bullish" | "Bearish" | "Neutral",
  "classification": "Cyclical" | "Counter-cyclical" | "Neutral",
  "impliedPoints": number | null,
  "confidence": number
}

Be precise and analytical. Consider the macro level when determining implied points.`;

    const userPrompt = `News Item:
Title: ${newsItem.title}
Content: ${newsItem.content}
Macro Level: ${newsItem.macroLevel}
Source: ${newsItem.source || 'Unknown'}
Symbols: ${newsItem.symbols?.join(', ') || 'None'}
User Instrument: ${userInstrument || 'Not specified'}

Provide your analysis as JSON.`;

    const { text } = await generateText({
      model: model as any,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      temperature: 0.3, // Lower temperature for more consistent analysis
      maxTokens: 500,
    });

    // Parse JSON response
    try {
      // Extract JSON from response (handle cases where AI adds extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        sentiment: string;
        classification: string;
        impliedPoints: number | null;
        confidence: number;
      };

      // Validate and normalize sentiment
      let sentiment: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
      if (parsed.sentiment.toLowerCase().includes('bullish')) {
        sentiment = 'Bullish';
      } else if (parsed.sentiment.toLowerCase().includes('bearish')) {
        sentiment = 'Bearish';
      }

      // Validate and normalize classification
      let classification: 'Cyclical' | 'Counter-cyclical' | 'Neutral' = 'Neutral';
      if (parsed.classification.toLowerCase().includes('cyclical')) {
        if (parsed.classification.toLowerCase().includes('counter')) {
          classification = 'Counter-cyclical';
        } else {
          classification = 'Cyclical';
        }
      }

      // Only include implied points for Level 3 and 4
      const impliedPoints = (newsItem.macroLevel === 3 || newsItem.macroLevel === 4)
        ? parsed.impliedPoints
        : null;

      return {
        sentiment,
        classification,
        impliedPoints,
        instrument: userInstrument || null,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      };
    } catch (parseError) {
      console.error('Failed to parse Price Brain Layer response:', parseError);
      console.error('Raw response:', text);
      
      // Fallback to neutral/default values
      return {
        sentiment: 'Neutral',
        classification: 'Neutral',
        impliedPoints: (newsItem.macroLevel === 3 || newsItem.macroLevel === 4) ? null : null,
        instrument: userInstrument || null,
        confidence: 0.3,
      };
    }
  } catch (error) {
    console.error('Price Brain Layer scoring error:', error);
    
    // Return neutral fallback on error
    return {
      sentiment: 'Neutral',
      classification: 'Neutral',
      impliedPoints: null,
      instrument: userInstrument || null,
      confidence: 0.0,
    };
  }
}

/**
 * Score multiple news items in batch
 */
export async function scoreNewsBatch(
  newsItems: Array<{ id: string; title: string; content: string; macroLevel?: 1 | 2 | 3 | 4; source?: string; symbols?: string[] }>,
  userInstrument?: string
): Promise<Map<string, PriceBrainScore>> {
  const scoresMap = new Map<string, PriceBrainScore>();

  // Score items in parallel (with rate limiting consideration)
  const scoringPromises = newsItems.map(async (item) => {
    const score = await scoreNewsWithPriceBrain(
      {
        title: item.title,
        content: item.content,
        macroLevel: item.macroLevel || 1,
        source: item.source,
        symbols: item.symbols,
      },
      userInstrument
    );
    return { id: item.id, score };
  });

  const results = await Promise.all(scoringPromises);
  
  for (const { id, score } of results) {
    scoresMap.set(id, score);
  }

  return scoresMap;
}
