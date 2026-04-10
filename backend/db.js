const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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

    console.log('[DB] Tables and indexes ready');

    // Auto-cleanup: keep only latest 20 per account per folder
    await autoCleanup(client);
  } finally {
    client.release();
  }
}

async function autoCleanup(client) {
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
  }
}

module.exports = { pool, initDB };
