
import { sql } from '../src/db/index.js';

async function checkSchema() {
    const tables = ['emotional_resonance_scores', 'trades', 'ai_conversations', 'ai_messages', 'journal_entries'];

    for (const table of tables) {
        console.log(`\n--- Schema for ${table} ---`);
        const cols = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = ${table}
      ORDER BY ordinal_position;
    `;
        if (cols.length === 0) {
            console.log('Table does not exist.');
        } else {
            cols.forEach(c => console.log(`${c.column_name} (${c.data_type})`));
        }
    }
    process.exit(0);
}

checkSchema();
