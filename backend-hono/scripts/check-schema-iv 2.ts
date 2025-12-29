
import { sql } from '../src/db/index.js';

async function checkIVSchema() {
    const table = 'iv_scores';
    console.log(`\n--- Schema for ${table} ---`);
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = ${table}
      ORDER BY ordinal_position;
    `;
    if (cols.length === 0) {
        console.log('Table does not exist.');
    } else {
        cols.forEach(c => console.log(`${c.column_name} (${c.data_type})`));
    }
    process.exit(0);
}

checkIVSchema();
