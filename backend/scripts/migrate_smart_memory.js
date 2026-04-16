require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('🚀 Running Conversation Type Migration...');
  const client = await pool.connect();
  try {
    // Add type column if it doesn't exist
    await client.query(`
      ALTER TABLE conversations 
      ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'chat';
    `);
    
    // Ensure all existing analysis-titled conversations are marked correctly (optional but helpful)
    await client.query(`
      UPDATE conversations 
      SET type = 'analysis' 
      WHERE title LIKE 'Data Analysis%';
    `);

    console.log('✅ MIGRATION SUCCESSFUL: type column added.');
  } catch (err) {
    console.error('❌ MIGRATION FAILED:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
