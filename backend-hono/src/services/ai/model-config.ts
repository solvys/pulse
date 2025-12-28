/**
 * AI Model Configuration
 * Model setup and gateway initialization
 */

import { anthropic } from '@ai-sdk/anthropic';
import { xai } from '@ai-sdk/xai';
import { groq } from '@ai-sdk/groq';
import { createGateway } from '@ai-sdk/gateway';
import { env } from '../../env.js';

// Model IDs
export const GROK_4_MODEL = 'grok-beta'; // Fallback for complex reasoning
export const GROK_VISION_MODEL = 'grok-2-1212';
export const CLAUDE_OPUS_4_MODEL = 'claude-opus-4-20250514'; // Primary: Complex reasoning, QuickPulse
export const CLAUDE_SONNET_4_5_MODEL = 'claude-3-5-sonnet-20241022'; // Autopilot trading, QuickPulse fallback
export const GROQ_LLAMA_3_70B_MODEL = 'llama3-70b-8192'; // NTN reports, News interpretation

let gateway: ReturnType<typeof createGateway> | null = null;
if (env.VERCEL_AI_GATEWAY_API_KEY) {
  gateway = createGateway({
    apiKey: env.VERCEL_AI_GATEWAY_API_KEY,
  });
}

export function getModel(modelName: string = 'claude-opus-4'): any {
  if (gateway) {
    switch (modelName) {
      case 'claude-opus-4':
      case 'claude-opus-4-20250514':
        return gateway(`anthropic/${CLAUDE_OPUS_4_MODEL}`);
      case 'claude-sonnet-4.5':
      case 'claude-sonnet-4-5':
      case 'claude-3-5-sonnet-20241022':
        return gateway(`anthropic/${CLAUDE_SONNET_4_5_MODEL}`);
      case 'llama-3-70b':
      case 'groq-llama-3-70b':
        // Gateway might not support Groq directly yet in this specific config, 
        // but if it does: return gateway(`groq/${GROQ_LLAMA_3_70B_MODEL}`);
        // Reset to direct for Groq to be safe or if key exists
        if (env.GROQ_API_KEY) return groq(GROQ_LLAMA_3_70B_MODEL);
        return gateway(`groq/${GROQ_LLAMA_3_70B_MODEL}`);
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
      return anthropic(CLAUDE_OPUS_4_MODEL);
    case 'claude-sonnet-4.5':
    case 'claude-sonnet-4-5':
    case 'claude-3-5-sonnet-20241022':
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured.');
      }
      return anthropic(CLAUDE_SONNET_4_5_MODEL);
    case 'llama-3-70b':
    case 'groq-llama-3-70b':
      if (!env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY not configured.');
      }
      return groq(GROQ_LLAMA_3_70B_MODEL);
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
