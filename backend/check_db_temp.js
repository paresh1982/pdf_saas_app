require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const tables = ['conversations', 'messages', 'documents'];
  for (const t of tables) {
    try {
      const res = await pool.query(`SELECT * FROM ${t} ORDER BY created_at DESC LIMIT 5`);
      console.log(`\n=== TABLE: ${t.toUpperCase()} (Total Records: ${ (await pool.query(`SELECT count(*) FROM ${t}`)).rows[0].count }) ===`);
      
      const rows = res.rows.map(r => {
        const cleaned = { ...r };
        if (cleaned.content && cleaned.content.length > 50) cleaned.content = cleaned.content.substring(0, 50) + '...';
        if (cleaned.extracted_text && cleaned.extracted_text.length > 50) cleaned.extracted_text = cleaned.extracted_text.substring(0, 50) + '...';
        return cleaned;
      });
      console.table(rows);
    } catch (e) {
      console.log(`Error checking ${t}:`, e.message);
    }
  }
  process.exit();
}

run();
