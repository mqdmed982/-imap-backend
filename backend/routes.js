const express = require('express');
const { pool } = require('./db');
const { pollAllAccounts, deleteEmailFromImap } = require('./imap');
const router = express.Router();

router.get('/accounts', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=30');
    const { rows } = await pool.query(
      `SELECT id, name, email, host, port, created_at FROM accounts ORDER BY created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Optimized: single JOIN query instead of N+1 per-account loop
router.get('/emails', async (req, res) => {
  try {
    const { filter, search } = req.query;
    const isSpamFilter = filter === 'spam' ? true : filter === 'inbox' ? false : null;
    const searchParam = search ? `%${search}%` : null;
    const limit = 15;

    // Build dynamic WHERE clauses
    const conditions = [];
    const params = [];
    let idx = 1;

    if (isSpamFilter !== null) {
      conditions.push(`e.is_spam = $${idx++}`);
      params.push(isSpamFilter);
    }

    if (searchParam) {
      conditions.push(`(e.subject ILIKE $${idx} OR e.sender_name ILIKE $${idx} OR e.sender_address ILIKE $${idx})`);
      params.push(searchParam);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // Single query: get top N inbox + top N spam per account using window functions
    const { rows } = await pool.query(`
      SELECT * FROM (
        SELECT
          e.id, e.sender_name, e.sender_address, e.subject,
          e.date, e.folder, e.is_spam, e.labels, e.fetched_at,
          a.id AS account_id, a.name AS account_name, a.email AS account_email,
          a.created_at AS account_created_at,
          ROW_NUMBER() OVER (
            PARTITION BY e.account_id, e.is_spam
            ORDER BY e.date DESC NULLS LAST
          ) AS rn
        FROM emails e
        JOIN accounts a ON a.id = e.account_id
        WHERE TRUE ${whereClause}
      ) ranked
      WHERE rn <= ${limit}
      ORDER BY account_created_at ASC, is_spam ASC, date DESC NULLS LAST
    `, params);

    // Group by account in JS (O(n) — no extra DB round trips)
    const accountMap = new Map();
    for (const row of rows) {
      if (!accountMap.has(row.account_id)) {
        accountMap.set(row.account_id, {
          account: {
            id: row.account_id,
            name: row.account_name,
            email: row.account_email,
          },
          emails: [],
        });
      }
      accountMap.get(row.account_id).emails.push({
        id: row.id,
        senderName: row.sender_name,
        senderAddress: row.sender_address,
        subject: row.subject,
        date: row.date,
        folder: row.folder,
        isSpam: row.is_spam,
        labels: row.labels,
        fetchedAt: row.fetched_at,
      });
    }

    // Preserve account order; include accounts with 0 emails
    const { rows: allAccounts } = await pool.query(
      `SELECT id, name, email FROM accounts ORDER BY created_at ASC`
    );
    const result = allAccounts.map(acc => (
      accountMap.get(acc.id) || { account: { id: acc.id, name: acc.name, email: acc.email }, emails: [] }
    ));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/emails/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, a.name as account_name, a.email as account_email
       FROM emails e JOIN accounts a ON a.id = e.account_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const e = rows[0];
    res.json({
      id: e.id,
      subject: e.subject,
      senderName: e.sender_name,
      senderAddress: e.sender_address,
      date: e.date,
      folder: e.folder,
      isSpam: e.is_spam,
      labels: e.labels,
      accountName: e.account_name,
      accountEmail: e.account_email,
      htmlBody: e.html_body,
      textBody: e.text_body,
      rawSource: e.raw_source,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=15');
    const [totals, byAccount] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE is_spam = FALSE) AS inbox_count,
          COUNT(*) FILTER (WHERE is_spam = TRUE)  AS spam_count,
          COUNT(*) AS total
        FROM emails
      `),
      pool.query(`
        SELECT a.name, a.email,
          COUNT(*) FILTER (WHERE e.is_spam = FALSE) AS inbox,
          COUNT(*) FILTER (WHERE e.is_spam = TRUE)  AS spam
        FROM accounts a
        LEFT JOIN emails e ON e.account_id = a.id
        GROUP BY a.id, a.name, a.email
        ORDER BY a.created_at ASC
      `),
    ]);

    res.json({
      total: parseInt(totals.rows[0].total),
      inboxCount: parseInt(totals.rows[0].inbox_count),
      spamCount: parseInt(totals.rows[0].spam_count),
      byAccount: byAccount.rows.map((r) => ({
        name: r.name, email: r.email,
        inbox: parseInt(r.inbox), spam: parseInt(r.spam),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/poll', async (req, res) => {
  res.json({ message: 'Poll started' });
  pollAllAccounts().catch(console.error);
});

router.delete('/emails/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, account_id, uid, folder FROM emails WHERE id = $1',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const email = rows[0];
    try {
      await deleteEmailFromImap(email.id, email.uid, email.folder);
    } catch (imapErr) {
      console.error('[IMAP] Delete failed:', imapErr.message);
    }
    await pool.query('DELETE FROM emails WHERE id = $1', [req.params.id]);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM accounts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cleanup', async (req, res) => {
  try {
    const { rowCount } = await pool.query(`
      DELETE FROM emails
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY account_id, is_spam ORDER BY date DESC NULLS LAST
          ) AS rn FROM emails
        ) ranked WHERE rn <= 20
      )
    `);
    res.json({ deleted: rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
