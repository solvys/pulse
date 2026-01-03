import { Hono } from 'hono';
import { aiService } from '../../services/ai-service-v2.js';
import { sql } from '../../db/index.js';
export const chatRoute = new Hono();
chatRoute.post('/', async (c) => {
    try {
        const { messages, conversationId } = await c.req.json();
        const userId = c.get('userId') || 'anonymous'; // Corrected context variable
        // 1. Fetch User Context (Last Journal Entry + ER State)
        const [journalRows, erRows] = await Promise.all([
            sql `SELECT entry_text FROM journal_entries WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1`,
            sql `SELECT score, factors FROM emotional_resonance_scores WHERE user_id = ${userId} ORDER BY recorded_at DESC LIMIT 1`
        ]);
        const lastJournal = journalRows[0]?.entry_text || "No previous session data.";
        const currentER = erRows[0] ? `ER Score: ${erRows[0].score}` : "ER Status: Neutral";
        // 2. Build System Prompt
        const systemContext = `
    You are 'Price', an elite trading psychology and risk management AI.
    
    IDENTITY:
    - Name: Price
    - Tone: Professional, slightly cynical but supportive, highly quantitative.
    - Role: Institutional Risk Manager & Performance Coach.
    
    CONTEXT:
    - Last Session Summary: "${lastJournal}"
    - Current Emotional State: ${currentER}
    
    DIRECTIVES:
    - Focus on risk management and psychology.
    - If user is tilting, suggest a break.
    - Use "The Tape" context if provided in the conversation.
    - Be concise.
    `;
        // 3. Stream Response
        // We pass the entire message history + system context
        // The aiService handles the calling of OpenRouter
        // new conversation or existing?
        let activeConvId = conversationId;
        if (!activeConvId) {
            activeConvId = crypto.randomUUID();
            await sql `
                INSERT INTO ai_conversations (id, user_id, title)
                VALUES (${activeConvId}, ${userId}, 'New Chat')
            `;
        }
        // Save User Message
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
            await sql `
                INSERT INTO ai_messages (id, conversation_id, role, content)
                VALUES (${crypto.randomUUID()}, ${activeConvId}, 'user', ${lastUserMsg.content})
            `;
        }
        // Update Conversation Timestamp
        await sql `UPDATE ai_conversations SET updated_at = NOW() WHERE id = ${activeConvId}`;
        // 3. Stream Response with Persistence
        return await aiService.streamChat(messages, systemContext, async (fullResponseText) => {
            // Save Assistant Message on Finish
            try {
                await sql `
                    INSERT INTO ai_messages (id, conversation_id, role, content)
                    VALUES (${crypto.randomUUID()}, ${activeConvId}, 'assistant', ${fullResponseText})
                 `;
            }
            catch (err) {
                console.error('Failed to save assistant message:', err);
            }
        });
    }
    catch (error) {
        console.error('Chat Route Error:', error);
        return c.json({ error: 'Failed to process chat request' }, 500);
    }
});
//# sourceMappingURL=chat.js.map