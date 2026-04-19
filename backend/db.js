const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000, // kill runaway queries after 10s
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
        raw_source TEXT,
        html_body TEXT,
        text_body TEXT,
        raw_headers TEXT,
        fetched_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(account_id, uid, folder)
      );
    `);

    // Add missing columns for existing DBs
    await client.query(`ALTER TABLE emails ADD COLUMN IF NOT EXISTS raw_source TEXT`);
    await client.query(`ALTER TABLE emails ADD COLUMN IF NOT EXISTS html_body TEXT`);
    await client.query(`ALTER TABLE emails ADD COLUMN IF NOT EXISTS text_body TEXT`);

    // Performance indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_account_spam ON emails(account_id, is_spam, date DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_account_id ON emails(account_id)`);
    // Covers the exact filter queries in routes.js
    await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_spam_date_cover ON emails(account_id, is_spam, date DESC NULLS LAST)`);
    // Speeds up search queries (trigram index for ILIKE)
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_subject_trgm ON emails USING gin(subject gin_trgm_ops)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_sender_trgm ON emails USING gin(sender_name gin_trgm_ops)`);

    console.log('[DB] Tables and indexes ready');
  } finally {
    client.release();
  }
}

// Called after each poll — not on every startup
async function autoCleanup() {
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(`
      DELETE FROM emails
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY account_id, is_spam ORDER BY date DESC NULLS LAST
          ) AS rn FROM emails
        ) ranked WHERE rn <= 20
      )
    `);
    if (rowCount > 0) console.log(`[DB] Cleanup: removed ${rowCount} old emails`);
  } catch (err) {
    console.error('[DB] Cleanup error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB, autoCleanup };
