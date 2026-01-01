/**
 * Price Brain Layer Service
 * AI-powered analysis of high-impact market news using Grok-4 via Vercel AI Gateway
 * 
 * Analyzes Level 3-4 macro events to provide:
 * - Sentiment classification (Bullish, Bearish, Neutral)
 * - Market classification (Cyclical, Counter-cyclical, Neutral)
 * - Implied points estimation (estimated price impact)
 * - Confidence scoring (0-1 scale)
 */

import { generateText } from 'ai';
import { getModel } from './ai/model-config.js';
import { logger } from '../middleware/logger.js';

export interface PriceBrainAnalysis {
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    classification: 'Cyclical' | 'Counter-cyclical' | 'Neutral';
    impliedPoints: number | null;
    confidence: number; // 0-1 scale
    instrument?: string | null;
}

export interface ArticleInput {
    title: string;
    content: string;
    summary?: string | null;
    macroLevel: number;
    symbols: string[];
    source?: string;
}

/**
 * Analyze a news article using Grok-4 via Vercel AI Gateway
 * Only processes Level 3 (high) or Level 4 (critical) macro events
 */
export async function analyzeArticleWithPriceBrain(
    article: ArticleInput
): Promise<PriceBrainAnalysis | null> {
    // Only analyze Level 3-4 articles
    if (article.macroLevel < 3) {
        logger.debug({ macroLevel: article.macroLevel }, 'Skipping Price Brain analysis - macro level too low');
        return null;
    }

    try {
        const model = getModel('grok-4');
        
        const symbolsText = article.symbols.length > 0 
            ? article.symbols.join(', ')
            : 'General market';

        const prompt = `You are an expert financial market analyst. Analyze the following financial news article and provide a structured JSON response.

Article Title: ${article.title}
Article Content: ${article.content || article.summary || ''}
Macro Level: ${article.macroLevel} (${article.macroLevel === 4 ? 'Critical' : 'High'} impact)
Relevant Symbols: ${symbolsText}
Source: ${article.source || 'Unknown'}

Provide your analysis in the following JSON format:
{
  "sentiment": "Bullish" | "Bearish" | "Neutral",
  "classification": "Cyclical" | "Counter-cyclical" | "Neutral",
  "impliedPoints": <number or null> (estimated price impact in points for ES/NQ/YM futures, null if not applicable),
  "confidence": <number between 0 and 1>,
  "instrument": "<string or null>" (primary instrument affected: ES, NQ, YM, CL, GC, ZB, or null)
}

Guidelines:
- Sentiment: Classify based on whether the news is generally positive (Bullish), negative (Bearish), or neutral for markets
- Classification: 
  * Cyclical = news that follows economic cycles (earnings, GDP, employment)
  * Counter-cyclical = news that moves against cycles (Fed policy, inflation, geopolitical events)
  * Neutral = unclear or balanced impact
- Implied Points: Estimate the potential price movement in futures points. Be conservative. Only provide if you have high confidence.
- Confidence: Rate your confidence in the analysis (0.0 = low, 1.0 = high)
- Instrument: Identify the primary futures contract most affected (ES for S&P 500, NQ for Nasdaq, YM for Dow, CL for oil, GC for gold, ZB for bonds)

Respond ONLY with valid JSON, no additional text.`;

        logger.info({ 
            articleId: article.title.substring(0, 50),
            macroLevel: article.macroLevel 
        }, 'Starting Price Brain analysis');

        const { text } = await generateText({
            model: model as any,
            prompt,
            temperature: 0.3, // Low temperature for consistency as per architecture docs
            // maxTokens removed - configured on model level in AI SDK v6
        });

        // Parse the JSON response
        let analysis: PriceBrainAnalysis;
        try {
            // Extract JSON from response (AI might add markdown formatting)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const jsonText = jsonMatch ? jsonMatch[0] : text;
            analysis = JSON.parse(jsonText);
        } catch (parseError) {
            logger.error({ 
                error: parseError,
                rawResponse: text 
            }, 'Failed to parse Price Brain JSON response');
            
            // Return default neutral analysis on parse error
            return {
                sentiment: 'Neutral',
                classification: 'Neutral',
                impliedPoints: null,
                confidence: 0.0,
                instrument: null,
            };
        }

        // Validate and normalize the response
        const validatedAnalysis: PriceBrainAnalysis = {
            sentiment: ['Bullish', 'Bearish', 'Neutral'].includes(analysis.sentiment) 
                ? analysis.sentiment 
                : 'Neutral',
            classification: ['Cyclical', 'Counter-cyclical', 'Neutral'].includes(analysis.classification)
                ? analysis.classification
                : 'Neutral',
            impliedPoints: typeof analysis.impliedPoints === 'number' 
                ? analysis.impliedPoints 
                : null,
            confidence: typeof analysis.confidence === 'number'
                ? Math.max(0, Math.min(1, analysis.confidence)) // Clamp to 0-1
                : 0.5,
            instrument: typeof analysis.instrument === 'string' && analysis.instrument.length > 0
                ? analysis.instrument
                : null,
        };

        logger.info({ 
            articleId: article.title.substring(0, 50),
            sentiment: validatedAnalysis.sentiment,
            classification: validatedAnalysis.classification,
            confidence: validatedAnalysis.confidence
        }, 'Price Brain analysis complete');

        return validatedAnalysis;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ 
            error: errorMessage,
            articleTitle: article.title.substring(0, 50),
            macroLevel: article.macroLevel
        }, 'Price Brain analysis failed');

        // Return null on error - caller can handle gracefully
        return null;
    }
}

/**
 * Batch analyze multiple articles
 * Processes articles in parallel but respects rate limits
 */
export async function analyzeArticlesBatch(
    articles: ArticleInput[]
): Promise<Map<string, PriceBrainAnalysis | null>> {
    const results = new Map<string, PriceBrainAnalysis | null>();
    
    // Filter to only Level 3-4 articles
    const highImpactArticles = articles.filter(a => a.macroLevel >= 3);
    
    if (highImpactArticles.length === 0) {
        logger.debug('No Level 3-4 articles to analyze');
        return results;
    }

    logger.info({ count: highImpactArticles.length }, 'Starting batch Price Brain analysis');

    // Process articles in parallel (with reasonable concurrency)
    // Note: Vercel AI Gateway handles rate limiting, but we can add delays if needed
    const analysisPromises = highImpactArticles.map(async (article) => {
        const analysis = await analyzeArticleWithPriceBrain(article);
        return { articleId: article.title, analysis };
    });

    const analysisResults = await Promise.allSettled(analysisPromises);
    
    analysisResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            results.set(result.value.articleId, result.value.analysis);
        } else {
            logger.error({ 
                error: result.reason,
                articleIndex: index 
            }, 'Price Brain batch analysis item failed');
            // Set null for failed analyses
            if (highImpactArticles[index]) {
                results.set(highImpactArticles[index].title, null);
            }
        }
    });

    logger.info({ 
        total: highImpactArticles.length,
        successful: Array.from(results.values()).filter(r => r !== null).length
    }, 'Batch Price Brain analysis complete');

    return results;
}

