const express = require('express');
const { pool } = require('./db');
const { pollAllAccounts, deleteEmailFromImap } = require('./imap');
const router = express.Router();

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

router.get('/emails', async (req, res) => {
  try {
    const { filter, search } = req.query;
    const searchParam = search ? `%${search}%` : null;
    const limit = 15; // per category per account

    const { rows: accounts } = await pool.query(
      `SELECT id, name, email FROM accounts ORDER BY created_at ASC`
    );

    const result = [];
    for (const acc of accounts) {
      let emails = [];
      const searchClause = searchParam
        ? `AND (e.subject ILIKE $2 OR e.sender_name ILIKE $2 OR e.sender_address ILIKE $2)`
        : '';

      if (!filter || filter === 'all') {
        const [inboxRows, spamRows] = await Promise.all([
          pool.query(
            `SELECT e.id, e.sender_name, e.sender_address, e.subject, e.date, e.folder, e.is_spam, e.labels, e.fetched_at
             FROM emails e
             WHERE e.is_spam = FALSE AND e.account_id = $1 ${searchClause}
             ORDER BY e.date DESC NULLS LAST LIMIT ${limit}`,
            searchParam ? [acc.id, searchParam] : [acc.id]
          ),
          pool.query(
            `SELECT e.id, e.sender_name, e.sender_address, e.subject, e.date, e.folder, e.is_spam, e.labels, e.fetched_at
             FROM emails e
             WHERE e.is_spam = TRUE AND e.account_id = $1 ${searchClause}
             ORDER BY e.date DESC NULLS LAST LIMIT ${limit}`,
            searchParam ? [acc.id, searchParam] : [acc.id]
          ),
        ]);
        emails = [...inboxRows.rows, ...spamRows.rows].sort(
          (a, b) => new Date(b.date || b.fetched_at) - new Date(a.date || a.fetched_at)
        );
      } else {
        const isSpam = filter === 'spam';
        const { rows } = await pool.query(
          `SELECT e.id, e.sender_name, e.sender_address, e.subject, e.date, e.folder, e.is_spam, e.labels, e.fetched_at
           FROM emails e
           WHERE e.is_spam = $1 AND e.account_id = $2 ${searchClause}
           ORDER BY e.date DESC NULLS LAST LIMIT ${limit * 2}`,
          searchParam ? [isSpam, acc.id, searchParam] : [isSpam, acc.id]
        );
        emails = rows;
      }

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
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_spam = FALSE) AS inbox_count,
        COUNT(*) FILTER (WHERE is_spam = TRUE)  AS spam_count,
        COUNT(*) AS total
      FROM emails
    `);
    const { rows: byAccount } = await pool.query(`
      SELECT a.name, a.email,
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

// DELETE /api/accounts/:id — remove account + all its emails
router.delete('/accounts/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM accounts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cleanup — delete old emails beyond latest 20 per account per folder
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
