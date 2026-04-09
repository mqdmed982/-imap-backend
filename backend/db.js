const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INTEGER DEFAULT 993,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS emails (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        uid VARCHAR(255),
        message_id VARCHAR(500),
        sender_name VARCHAR(255),
        sender_address VARCHAR(255),
        subject TEXT,
        date TIMESTAMP,
        folder VARCHAR(50) DEFAULT 'INBOX',
        is_spam BOOLEAN DEFAULT FALSE,
        labels TEXT[] DEFAULT '{}',
        raw_headers TEXT,
        fetched_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(account_id, uid, folder)
      );

      CREATE INDEX IF NOT EXISTS idx_emails_account_id ON emails(account_id);
      CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);
      CREATE INDEX IF NOT EXISTS idx_emails_is_spam ON emails(is_spam);
    `);
    console.log('[DB] Tables ready');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
