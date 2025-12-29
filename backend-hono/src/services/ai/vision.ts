/**
 * AI Vision Functions
 * Image analysis for trading screenshots
 */

import { generateText } from 'ai';
import { getVisionModel } from './model-config.js';

export async function analyzeImage(
  imageData: Buffer | string,
  prompt: string,
  marketContext?: string
): Promise<string> {
  try {
    const model = getVisionModel();
    const contextPrompt = marketContext
      ? `${prompt}\n\nMarket Context: ${marketContext}`
      : prompt;

    const imageBase64 = typeof imageData === 'string' 
      ? imageData 
      : imageData.toString('base64');

    const { text } = await generateText({
      model: model as any,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: contextPrompt },
            {
              type: 'image',
              image: imageBase64,
            },
          ],
        },
      ],
      temperature: 0.7,
      // maxTokens removed - configured on model level in AI SDK v6
    });

    return text;
  } catch (error) {
    console.error('Image analysis error:', error);
    return 'Unable to analyze image at this time.';
  }
}
