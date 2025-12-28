/**
 * AI Model Configuration
 * Model setup and gateway initialization
 */

import { anthropic } from '@ai-sdk/anthropic';
import { xai } from '@ai-sdk/xai';
import { createGateway } from '@ai-sdk/gateway';
import { env } from '../../env.js';

export const GROK_4_MODEL = 'grok-4';
export const GROK_VISION_MODEL = 'grok-2-1212';
export const CLAUDE_OPUS_4_5_MODEL = 'claude-opus-4-20250514';
export const CLAUDE_SONNET_4_5_MODEL = 'claude-3-5-sonnet-20241022';

let gateway: ReturnType<typeof createGateway> | null = null;
if (env.VERCEL_AI_GATEWAY_API_KEY) {
  gateway = createGateway({
    apiKey: env.VERCEL_AI_GATEWAY_API_KEY,
  });
}

export function getModel(modelName: string = 'grok-4'): any {
  if (gateway) {
    switch (modelName) {
      case 'claude-opus-4':
      case 'claude-opus-4-20250514':
        return gateway(`anthropic/${CLAUDE_OPUS_4_5_MODEL}`);
      case 'claude-sonnet-4.5':
      case 'claude-sonnet-4-5':
      case 'claude-3-5-sonnet-20241022':
        return gateway(`anthropic/${CLAUDE_SONNET_4_5_MODEL}`);
      case 'grok-4':
      default:
        return gateway(`xai/${GROK_4_MODEL}`);
    }
  }

  switch (modelName) {
    case 'claude-opus-4':
    case 'claude-opus-4-20250514':
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured. Either set VERCEL_AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY');
      }
      return anthropic(CLAUDE_OPUS_4_5_MODEL);
    case 'claude-sonnet-4.5':
    case 'claude-sonnet-4-5':
    case 'claude-3-5-sonnet-20241022':
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured. Either set VERCEL_AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY');
      }
      return anthropic(CLAUDE_SONNET_4_5_MODEL);
    case 'grok-4':
    default:
      if (!env.XAI_API_KEY) {
        throw new Error('XAI_API_KEY not configured. Either set VERCEL_AI_GATEWAY_API_KEY or XAI_API_KEY');
      }
      return xai(GROK_4_MODEL);
  }
}

export function getVisionModel(): any {
  if (gateway) {
    return gateway(`xai/${GROK_VISION_MODEL}`);
  }

  if (!env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY not configured. Either set VERCEL_AI_GATEWAY_API_KEY or XAI_API_KEY');
  }
  return xai(GROK_VISION_MODEL);
}
