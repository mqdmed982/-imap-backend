# Inboxious — IMAP Email Monitoring Dashboard

Monitor multiple email accounts (Gmail, Outlook, Yahoo) for inbox/spam placement.
Built with Node.js + Express + PostgreSQL (backend) and React (frontend).
Deployable on Render.com with one config file.

---

## Project Structure

```
inboxious/
├── backend/
│   ├── server.js       ← Express entry point + cron scheduler
│   ├── imap.js         ← IMAP connection + email fetcher
│   ├── db.js           ← PostgreSQL pool + table init
│   ├── routes.js       ← REST API routes
│   ├── .env.example    ← Copy to .env and fill in credentials
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── pages/Dashboard.jsx     ← Main dashboard UI
│   │   ├── components/
│   │   │   ├── AccountPanel.jsx    ← Per-account inbox card
│   │   │   ├── Badge.jsx           ← Inbox/spam/personal badges
│   │   │   └── DonutChart.jsx      ← Provider % donut chart
│   │   └── hooks/useEmails.js      ← Data fetching + auto-refresh
│   ├── public/index.html
│   ├── .env.example
│   └── package.json
└── render.yaml         ← One-click Render.com deploy config
```

---

## Local Development

### 1. Clone and install

```bash
git clone <your-repo>
cd inboxious

# Backend
cd backend
cp .env.example .env
npm install

# Frontend
cd ../frontend
cp .env.example .env
npm install
```

### 2. Set up PostgreSQL locally

Install PostgreSQL and create a database:

```sql
CREATE DATABASE inboxious;
```

Update `backend/.env`:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/inboxious
```

### 3. Configure email accounts

In `backend/.env`, add one block per account:

```env
ACCOUNT_1_NAME=David
ACCOUNT_1_EMAIL=david@gmail.com
ACCOUNT_1_PASSWORD=xxxx xxxx xxxx xxxx   ← Gmail App Password
ACCOUNT_1_HOST=imap.gmail.com
ACCOUNT_1_PORT=993

ACCOUNT_2_NAME=Carla
ACCOUNT_2_EMAIL=carla@gmail.com
ACCOUNT_2_PASSWORD=xxxx xxxx xxxx xxxx
ACCOUNT_2_HOST=imap.gmail.com
ACCOUNT_2_PORT=993
```

For **Gmail**: Go to Google Account → Security → 2-Step Verification → App Passwords.
Generate a 16-character app password and use it (not your regular password).

For **Outlook**: Use `outlook.office365.com` as host.
For **Yahoo**: Use `imap.mail.yahoo.com` as host.

### 4. Run locally

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm start
```

Open http://localhost:3000

---

## Deploy to Render.com

### Option A — Automatic (render.yaml)

1. Push this repo to GitHub
2. Go to https://render.com → New → Blueprint
3. Connect your GitHub repo
4. Render detects `render.yaml` and creates backend + frontend + database automatically
5. In the Render dashboard, go to **inboxious-backend** → Environment
6. Add your account variables manually (never commit passwords to git):
   - `ACCOUNT_1_NAME`, `ACCOUNT_1_EMAIL`, `ACCOUNT_1_PASSWORD`, `ACCOUNT_1_HOST`, `ACCOUNT_1_PORT`
   - Repeat for each account

### Option B — Manual

1. Create a **PostgreSQL** database on Render → copy the connection string
2. Create a **Web Service** for the backend:
   - Root dir: `backend`
   - Build: `npm install`
   - Start: `node server.js`
   - Add all env vars from `.env.example`
3. Create a **Static Site** for the frontend:
   - Root dir: `frontend`
   - Build: `npm install && npm run build`
   - Publish dir: `build`
   - Add `REACT_APP_API_URL=https://your-backend.onrender.com`

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/emails` | All emails grouped by account |
| GET | `/api/emails?filter=inbox` | Inbox only |
| GET | `/api/emails?filter=spam` | Spam only |
| GET | `/api/emails?search=carshield` | Search emails |
| GET | `/api/stats` | Counts by inbox/spam/account |
| GET | `/api/accounts` | List all configured accounts |
| POST | `/api/poll` | Manually trigger IMAP poll |
| GET | `/health` | Health check |

---

## How It Works

1. On startup, the backend connects to each IMAP account and fetches the last 20 emails from `INBOX` and `[Gmail]/Spam`
2. Emails are stored in PostgreSQL with spam/inbox classification
3. A cron job repeats this every 30 seconds (configurable via `POLL_INTERVAL`)
4. The React frontend polls `/api/emails` every 30 seconds and updates the UI
5. Users can filter by inbox/spam and search by subject or sender

---

## Notes

- Gmail requires **App Passwords** (not your login password). Enable 2FA first.
- The `[Gmail]/Spam` folder name is Gmail-specific. For Outlook/Yahoo it falls back to `Junk`.
- Sender addresses are masked in the UI for privacy.
