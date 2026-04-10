const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { pool } = require('./db');

function getAccountsFromEnv() {
  const accounts = [];
  let i = 1;
  while (process.env[`ACCOUNT_${i}_EMAIL`]) {
    accounts.push({
      name: process.env[`ACCOUNT_${i}_NAME`] || `Account ${i}`,
      email: process.env[`ACCOUNT_${i}_EMAIL`],
      password: process.env[`ACCOUNT_${i}_PASSWORD`],
      host: process.env[`ACCOUNT_${i}_HOST`] || 'imap.gmail.com',
      port: parseInt(process.env[`ACCOUNT_${i}_PORT`] || '993'),
    });
    i++;
  }
  return accounts;
}

// Remove null bytes and invalid UTF8 sequences that crash PostgreSQL
function sanitizeText(str) {
  if (!str) return null;
  return str
    .replace(/\x00/g, '')
    .replace(/\\u0000/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '');
}

// Sequential delay helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchFolder(config, folderName) {
  return new Promise((resolve) => {
    const imap = new Imap({
      user: config.email,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 15000,
      connTimeout: 15000,
    });

    const emails = [];
    let settled = false;

    function done(result) {
      if (settled) return;
      settled = true;
      try { imap.end(); } catch (_) {}
      resolve(result);
    }

    imap.once('ready', () => {
      imap.openBox(folderName, true, (err, box) => {
        if (err) return done([]);
        const total = box.messages.total;
        if (total === 0) return done([]);

        const start = Math.max(1, total - 19);
        const fetch = imap.seq.fetch(`${start}:${total}`, {
          bodies: [''],
          struct: true,
        });

        fetch.on('message', (msg, seqno) => {
          const emailData = { uid: String(seqno), folder: folderName };
          const chunks = [];

          msg.on('body', (stream) => {
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => {
              emailData.rawSource = Buffer.concat(chunks).toString('utf8');
            });
          });

          msg.once('end', () => emails.push(emailData));
        });

        fetch.once('error', (err) => {
          console.error(`[IMAP] Fetch error for ${config.email}:`, err.message);
          done([]);
        });

        fetch.once('end', async () => {
          const parsed = [];
          for (const e of emails) {
            try {
              const mail = await simpleParser(e.rawSource || '');
              parsed.push({
                uid: e.uid,
                folder: e.folder,
                messageId: sanitizeText(mail.messageId),
                senderName: sanitizeText(mail.from?.value?.[0]?.name || ''),
                senderAddress: sanitizeText(mail.from?.value?.[0]?.address || ''),
                subject: sanitizeText(mail.subject || '(no subject)'),
                date: mail.date || new Date(),
                htmlBody: sanitizeText(mail.html || null),
                textBody: sanitizeText(mail.text || null),
                rawSource: sanitizeText(e.rawSource || null),
              });
            } catch (_) {}
          }
          done(parsed);
        });
      });
    });

    imap.once('error', (err) => {
      console.error(`[IMAP] Connection error for ${config.email}:`, err.message);
      done([]);
    });

    imap.once('end', () => {});
    imap.connect();
  });
}

async function ensureAccount(config) {
  const { rows } = await pool.query(
    `INSERT INTO accounts (name, email, host, port, password)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET name=$1, host=$3, port=$4, password=$5
     RETURNING id`,
    [config.name, config.email, config.host, config.port, config.password]
  );
  return rows[0].id;
}

async function saveEmails(accountId, emails, isSpam) {
  for (const e of emails) {
    try {
      const labels = isSpam ? ['spam'] : ['inbox'];
      await pool.query(
        `INSERT INTO emails
           (account_id, uid, message_id, sender_name, sender_address, subject, date, folder, is_spam, labels, html_body, text_body, raw_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (account_id, uid, folder) DO UPDATE
           SET sender_name=$4, sender_address=$5, subject=$6, date=$7, is_spam=$9, labels=$10,
               html_body=$11, text_body=$12, raw_source=$13, fetched_at=NOW()`,
        [
          accountId, e.uid, e.messageId, e.senderName, e.senderAddress,
          e.subject, e.date, e.folder, isSpam, labels,
          e.htmlBody, e.textBody, e.rawSource,
        ]
      );
    } catch (err) {
      console.error('[DB] Save email error:', err.message);
    }
  }
}

async function pollAccount(config) {
  console.log(`[IMAP] Polling ${config.email}...`);
  try {
    const accountId = await ensureAccount(config);

    // Fetch inbox first, then spam — SEQUENTIAL to avoid "too many connections"
    const inboxEmails = await fetchFolder(config, 'INBOX');
    await sleep(1000); // 1s pause between connections for same account
    const spamEmails = await fetchFolder(config, '[Gmail]/Spam')
      .catch(() => fetchFolder(config, 'Junk'))
      .catch(() => []);

    await saveEmails(accountId, inboxEmails, false);
    await saveEmails(accountId, spamEmails, true);

    console.log(`[IMAP] ${config.email}: ${inboxEmails.length} inbox, ${spamEmails.length} spam`);
  } catch (err) {
    console.error(`[IMAP] Poll failed for ${config.email}:`, err.message);
  }
}

async function pollAllAccounts() {
  const accounts = getAccountsFromEnv();
  if (accounts.length === 0) {
    console.warn('[IMAP] No accounts configured in environment variables');
    return;
  }
  // Poll accounts SEQUENTIALLY with delay — prevents Gmail "too many connections"
  for (const account of accounts) {
    await pollAccount(account);
    await sleep(2000); // 2s between accounts
  }
}

async function deleteEmailFromImap(emailId, emailUid, folder) {
  const { rows } = await pool.query(
    `SELECT a.email, a.password, a.host, a.port
     FROM accounts a
     JOIN emails e ON e.account_id = a.id
     WHERE e.id = $1`,
    [emailId]
  );
  if (rows.length === 0) throw new Error('Account not found');
  const config = rows[0];

  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.email,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 15000,
    });

    imap.once('ready', () => {
      imap.openBox(folder, false, (err) => {
        if (err) { imap.end(); return reject(err); }
        imap.seq.addFlags(emailUid, '\\Deleted', (err) => {
          if (err) { imap.end(); return reject(err); }
          imap.expunge((err) => {
            imap.end();
            if (err) return reject(err);
            resolve();
          });
        });
      });
    });

    imap.once('error', (err) => reject(err));
    imap.connect();
  });
}

module.exports = { pollAllAccounts, getAccountsFromEnv, deleteEmailFromImap };
