require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { initDB } = require('./db');
const { pollAllAccounts } = require('./imap');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 4000;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30');

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'DELETE'],
}));
app.use(express.json());

app.use('/api', routes);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

async function start() {
  await initDB();

  // Poll immediately on startup
  await pollAllAccounts();

  // Then poll on a schedule (every N seconds)
  const cronExpr = POLL_INTERVAL <= 59
    ? `*/${POLL_INTERVAL} * * * * *`
    : `0 */${Math.floor(POLL_INTERVAL / 60)} * * * *`;

  cron.schedule(cronExpr, () => {
    pollAllAccounts().catch(console.error);
  });

  console.log(`[CRON] Polling every ${POLL_INTERVAL}s`);

  app.listen(PORT, () => {
    console.log(`[SERVER] Running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[SERVER] Fatal startup error:', err);
  process.exit(1);
});
