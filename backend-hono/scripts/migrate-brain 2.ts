
import { sql } from '../src/db/index.js';

async function migrateBrainLayer() {
    console.log('Starting Brain Layer Migration...');

    try {
        // 1. Create journal_entries table
        console.log('Creating journal_entries table...');
        await sql`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        session_id UUID, -- Optional link to ER session
        entry_text TEXT,
        market_context JSONB, -- VIX, Algo State, etc.
        emotional_state JSONB, -- Tilt score, mood
        tags TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

        // 2. Ensure ai_conversations has necessary fields
        console.log('Checking ai_conversations...');
        // Add columns if they don't exist (idempotent-ish check)
        await sql`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        title TEXT,
        model TEXT,
        is_active BOOLEAN DEFAULT true,
        last_message_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

        // 3. Ensure ai_messages has necessary fields
        console.log('Checking ai_messages...');
        await sql`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES ai_conversations(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens_used INTEGER,
        model TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

        console.log('Brain Layer Schema Migration Complete.');
    } catch (e) {
        console.error('Migration Failed:', e);
    } finally {
        process.exit(0);
    }
}

migrateBrainLayer();
