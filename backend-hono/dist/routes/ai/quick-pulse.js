import { Hono } from 'hono';
import { aiService } from '../../services/ai-service-v2.js';
import { sql } from '../../db/index.js';
export const quickPulseRoute = new Hono();
quickPulseRoute.post('/', async (c) => {
    try {
        const { image, algoState } = await c.req.json();
        const userId = c.get('user')?.id || 'anonymous';
        // 1. Fetch "The Tape" Context (Last 10 News Items)
        const newsRows = await sql `
      SELECT title, sentiment, source 
      FROM news_articles 
      ORDER BY published_at DESC 
      LIMIT 10
    `;
        const newsContext = newsRows.map((n) => `- [${n.source}] ${n.title} (${n.sentiment})`).join('\n');
        // 2. Prompt for Vision
        const prompt = `
    ANALYZE THIS CHART SCREENSHOT.

    CONTEXT:
    - Algo State: ${JSON.stringify(algoState)}
    - Recent News (The Tape):
    ${newsContext}

    TASK:
    - Identify Market Structure (Trend, Support/Resistance).
    - Determine Bias (Bullish/Bearish/Neutral).
    - Suggest a Setup if valid.

    OUTPUT JSON ONLY:
    {
      "bias": "Bullish" | "Bearish" | "Neutral",
      "confidence": number (0-100),
      "rationale": "Short explanation referencing news and chart structure.",
      "kpi": {
        "entry1": number,
        "entry2": number,
        "stop": number,
        "target": number
      }
    }
    `;
        // 3. Call Vision Model
        const analysisJson = await aiService.analyzeImage(image, prompt, "You are a specialized Technical Analyst AI.");
        // 4. Return JSON
        // The model might return markdown code blocks, strip them if needed
        const cleanJson = analysisJson.replace(/```json/g, '').replace(/```/g, '').trim();
        let result;
        try {
            result = JSON.parse(cleanJson);
        }
        catch (e) {
            // Fallback if model returned plain text
            result = { bias: "Neutral", confidence: 0, rationale: cleanJson, kpi: {} };
        }
        return c.json(result);
    }
    catch (error) {
        console.error('Quick Pulse Error:', error);
        return c.json({ error: 'Failed to generate Quick Pulse' }, 500);
    }
});
//# sourceMappingURL=quick-pulse.js.map