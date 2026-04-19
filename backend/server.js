require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cron = require('node-cron');
const { initDB, autoCleanup } = require('./db');
const { pollAllAccounts } = require('./imap');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 4000;
// Minimum 60s to respect Gmail's connection limits
const POLL_INTERVAL = Math.max(60, parseInt(process.env.POLL_INTERVAL || '120'));

// Compression — reduces JSON response size by ~70%
app.use(compression({
  level: 6,
  threshold: 1024, // only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'DELETE'],
}));
app.use(express.json());
app.use('/api', routes);
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

let polling = false;

async function safePoll() {
  if (polling) {
    console.log('[CRON] Skipping poll — previous poll still running');
    return;
  }
  polling = true;
  try {
    await pollAllAccounts();
    // Cleanup runs after poll, not on startup
    await autoCleanup();
  } finally {
    polling = false;
  }
}

async function start() {
  await initDB();

  // Initial poll on startup
  safePoll();

  // Schedule — minimum every 60s, skip if previous still running
  const mins = Math.floor(POLL_INTERVAL / 60);
  const cronExpr = mins >= 1 ? `*/${mins} * * * *` : `* * * * *`;
  cron.schedule(cronExpr, safePoll);
  console.log(`[CRON] Polling every ${POLL_INTERVAL}s (cron: ${cronExpr})`);

  app.listen(PORT, () => {
    console.log(`[SERVER] Running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[SERVER] Fatal startup error:', err);
  process.exit(1);
});
