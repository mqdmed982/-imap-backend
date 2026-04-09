const express = require('express');
const { pool } = require('./db');
const { pollAllAccounts } = require('./imap');
const router = express.Router();

// GET /api/accounts — list all monitored accounts
router.get('/accounts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, host, port, created_at FROM accounts ORDER BY created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/emails — all emails, grouped by account
router.get('/emails', async (req, res) => {
  try {
    const { filter, search } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (filter === 'inbox') {
      where += ` AND e.is_spam = FALSE`;
    } else if (filter === 'spam') {
      where += ` AND e.is_spam = TRUE`;
    }

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (e.subject ILIKE $${params.length} OR e.sender_name ILIKE $${params.length} OR e.sender_address ILIKE $${params.length})`;
    }

    const { rows: accounts } = await pool.query(
      `SELECT id, name, email FROM accounts ORDER BY created_at ASC`
    );

    const result = [];
    for (const acc of accounts) {
      const { rows: emails } = await pool.query(
        `SELECT
           e.id, e.uid, e.sender_name, e.sender_address,
           e.subject, e.date, e.folder, e.is_spam, e.labels, e.fetched_at
         FROM emails e
         ${where}
           AND e.account_id = $${params.length + 1}
         ORDER BY e.fetched_at DESC
         LIMIT 20`,
        [...params, acc.id]
      );
      result.push({
        account: { id: acc.id, name: acc.name, email: acc.email },
        emails: emails.map((e) => ({
          id: e.id,
          senderName: e.sender_name,
          senderAddress: e.sender_address,
          subject: e.subject,
          date: e.date,
          folder: e.folder,
          isSpam: e.is_spam,
          labels: e.labels,
          fetchedAt: e.fetched_at,
        })),
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats — inbox/spam counts per provider
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_spam = FALSE) AS inbox_count,
        COUNT(*) FILTER (WHERE is_spam = TRUE)  AS spam_count,
        COUNT(*) AS total
      FROM emails
    `);

    const { rows: byAccount } = await pool.query(`
      SELECT
        a.name, a.email,
        COUNT(*) FILTER (WHERE e.is_spam = FALSE) AS inbox,
        COUNT(*) FILTER (WHERE e.is_spam = TRUE)  AS spam
      FROM accounts a
      LEFT JOIN emails e ON e.account_id = a.id
      GROUP BY a.id, a.name, a.email
      ORDER BY a.created_at ASC
    `);

    res.json({
      total: parseInt(rows[0].total),
      inboxCount: parseInt(rows[0].inbox_count),
      spamCount: parseInt(rows[0].spam_count),
      byAccount: byAccount.map((r) => ({
        name: r.name,
        email: r.email,
        inbox: parseInt(r.inbox),
        spam: parseInt(r.spam),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/poll — manually trigger a poll
router.post('/poll', async (req, res) => {
  res.json({ message: 'Poll started' });
  pollAllAccounts().catch(console.error);
});

module.exports = router;
