# Expense Tracker

A personal expense tracker with two parts:

- **backend/** — a small API (Node.js + Express) that stores your expenses in Supabase (Postgres)
- **frontend/** — a PWA (installable web app) with History, Track (quick keypad entry), and Analytics tabs

The iPhone Back Tap → popup → save flow is handled entirely by the **iOS Shortcuts app**
(see below) — it talks to the backend directly, no code needed on the phone side.

See [CONCEPTS.md](CONCEPTS.md) for a plain-language explanation of the tech used here.

## Live deployment

- Frontend (open this on your iPhone, then Add to Home Screen): https://expense-tracker-1-hbdp.onrender.com
- Backend API: https://expense-tracker-7vtl.onrender.com

Render's free tier spins the backend down after ~15 minutes idle — the first
request after a gap takes ~30-50 seconds to wake back up. Your data is safe
either way since it lives in Supabase, not on Render's disk.

## Local development

```bash
cd backend
npm install
cp .env.example .env   # then fill in your real API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
npm start
```

```bash
cd frontend
npx serve . -l 5173
```

`frontend/app.js`'s `API_BASE` is currently pointed at the live Render backend
above. Point it at `http://localhost:3000` (or your PC's LAN IP, for testing
from a phone on the same Wi-Fi) while doing local development, then switch it
back before pushing.

## Database (Supabase)

Table `expenses`, with Row Level Security enabled and no policies — only the
backend (using the `service_role` key, which bypasses RLS) can read or write:

```sql
create extension if not exists pgcrypto;

create table expenses (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  note text not null default '',
  date date not null,
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;
```

## Set up the Back Tap shortcut (on your iPhone)

1. Open the **Shortcuts** app → **+** to create a new shortcut
2. Add action **"Ask for Input"** → Input Type: `Number` → Prompt: `Amount`
3. Add another **"Ask for Input"** → Input Type: `Text` → Prompt: `Note`
   (optional per entry — e.g. "coffee", "cab" — leave blank and just save if
   you don't want to type anything)
4. Add action **"Get Contents of URL"**:
   - URL: `https://expense-tracker-7vtl.onrender.com/api/expenses`
   - Method: `POST`
   - Headers: `Content-Type: application/json`, `x-api-key: exp-tracker-9f3a2c1d7e`
   - Request Body: JSON —
     ```json
     { "amount": <Ask for Input (Amount)>, "note": <Ask for Input (Note)> }
     ```
     (tap each value box and pick the matching "Ask for Input" chip — there'll
     be two, one per prompt, so make sure each field points to the right one)
5. (Optional) Add **"Show Notification"** → "Expense saved"
6. Name the shortcut (e.g. "Log Expense")
7. Go to **Settings → Accessibility → Touch → Back Tap → Double Tap** → select
   your shortcut

Now double-tapping the back of your phone asks for an amount and saves it —
no app needs to open, and it works anywhere, not just home Wi-Fi.

## Project structure

```
expense-tracker/
├── backend/
│   ├── server.js       # the API (Express + Supabase client)
│   ├── .env.example    # required env vars, no real secrets
│   └── package.json
├── frontend/
│   ├── index.html      # History / Track / Analytics views
│   ├── app.js
│   ├── style.css
│   ├── manifest.json   # PWA metadata
│   └── sw.js            # service worker (offline app shell)
├── README.md
└── CONCEPTS.md
```
