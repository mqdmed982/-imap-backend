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

function fetchFolder(config, folderName) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.email,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    });

    const emails = [];

    imap.once('ready', () => {
      imap.openBox(folderName, true, (err, box) => {
        if (err) {
          imap.end();
          return resolve([]);
        }

        const total = box.messages.total;
        if (total === 0) {
          imap.end();
          return resolve([]);
        }

        const start = Math.max(1, total - 19);
        const fetch = imap.seq.fetch(`${start}:${total}`, {
          bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)', 'TEXT'],
          struct: true,
        });

        fetch.on('message', (msg, seqno) => {
          const emailData = { uid: String(seqno), folder: folderName };
          const buffers = {};

          msg.on('body', (stream, info) => {
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => {
              buffers[info.which] = Buffer.concat(chunks).toString('utf8');
            });
          });

          msg.once('end', () => {
            const headerRaw = buffers['HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)'] || '';
            emailData.rawHeaders = headerRaw;
            emails.push(emailData);
          });
        });

        fetch.once('error', (err) => {
          console.error(`[IMAP] Fetch error for ${config.email}:`, err.message);
        });

        fetch.once('end', async () => {
          const parsed = [];
          for (const e of emails) {
            try {
              const mail = await simpleParser(e.rawHeaders);
              parsed.push({
                uid: e.uid,
                folder: e.folder,
                messageId: mail.messageId || null,
                senderName: mail.from?.value?.[0]?.name || '',
                senderAddress: mail.from?.value?.[0]?.address || '',
                subject: mail.subject || '(no subject)',
                date: mail.date || new Date(),
              });
            } catch (_) {}
          }
          imap.end();
          resolve(parsed);
        });
      });
    });

    imap.once('error', (err) => {
      console.error(`[IMAP] Connection error for ${config.email}:`, err.message);
      resolve([]);
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
           (account_id, uid, message_id, sender_name, sender_address, subject, date, folder, is_spam, labels)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (account_id, uid, folder) DO UPDATE
           SET sender_name=$4, sender_address=$5, subject=$6, date=$7, is_spam=$9, labels=$10, fetched_at=NOW()`,
        [
          accountId,
          e.uid,
          e.messageId,
          e.senderName,
          e.senderAddress,
          e.subject,
          e.date,
          e.folder,
          isSpam,
          labels,
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

    const [inboxEmails, spamEmails] = await Promise.all([
      fetchFolder(config, 'INBOX'),
      fetchFolder(config, '[Gmail]/Spam').catch(() => fetchFolder(config, 'Junk')),
    ]);

    await saveEmails(accountId, inboxEmails, false);
    await saveEmails(accountId, spamEmails, true);

    console.log(
      `[IMAP] ${config.email}: ${inboxEmails.length} inbox, ${spamEmails.length} spam`
    );
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
  for (const account of accounts) {
    await pollAccount(account);
  }
}

module.exports = { pollAllAccounts, getAccountsFromEnv };
