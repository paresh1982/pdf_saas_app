require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:hpKRz5wyVUj66vMr@db.wwiecxslvwfknamscnta.supabase.co:5432/postgres',
});

const schema = `
-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Messages table (chat history)
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Documents table (uploaded files metadata)
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    user_id TEXT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    extracted_text TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
`;

async function migrate() {
  console.log('🚀 Starting Supabase Database Migration...');
  const client = await pool.connect();
  try {
    await client.query(schema);
    console.log('✅ DATABASE SCHEMA CREATED SUCCESSFULLY');
  } catch (err) {
    console.error('❌ MIGRATION FAILED:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
