import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const { messages } = await req.json();
  
  const result = await streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages,
    system: `You are Price, an AI trading assistant for Pulse. You help traders with:
- Market analysis and insights
- Trade planning and risk management
- Emotional resonance and blindspot awareness
- Journal review and learning from past trades

Be concise, actionable, and supportive.`,
  });
  
  return result.toTextStreamResponse();
}
