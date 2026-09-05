# Expense Tracker

A personal expense tracker with two parts:

- **backend/** — a small API (Node.js + Express) that stores your expenses in a JSON file
- **frontend/** — a PWA (installable web app) that shows your expenses and lets you add them manually

The iPhone Back Tap → popup → save flow is handled entirely by the **iOS Shortcuts app**
(see below) — it talks to the backend directly, no code needed on the phone side.

See [CONCEPTS.md](CONCEPTS.md) for a plain-language explanation of the tech used here.

## 1. Run the backend

```bash
cd backend
npm install
API_KEY=exp-tracker-9f3a2c1d7e npm start
```

This starts the API at `http://localhost:3000`. Keep this terminal open.

`exp-tracker-9f3a2c1d7e` is the shared secret — it's already hardcoded into
`frontend/app.js`, so use this exact value here too (and again later in the
Shortcut's header). If you ever want to change it, update it in all three
places: this command, `frontend/app.js`, and the Shortcut.

## 2. Run the frontend

The frontend is static files, so any simple web server works. Easiest option:

```bash
cd frontend
npx serve .
```

Open the URL it gives you (usually `http://localhost:3000` — if that clashes
with the backend port, `npx serve . -l 5173` to use a different one).

On your iPhone, open that same URL in Safari, tap the Share icon, and choose
**Add to Home Screen** — that installs it as the PWA.

> Note: while both are running on your Windows PC, your iPhone can only reach
> them if it's on the same Wi-Fi network and you use your PC's local IP
> (e.g. `http://192.168.1.23:3000`) instead of `localhost`. For real daily
> use (so Back Tap works from anywhere), deploy the backend — see below.

## 3. Set up the Back Tap shortcut (on your iPhone)

1. Open the **Shortcuts** app → **+** to create a new shortcut
2. Add action **"Ask for Input"** → Input Type: `Number` → Prompt: `Amount`
3. Add another **"Ask for Input"** → Input Type: `Text` → Prompt: `Note`
   (optional per entry — e.g. "coffee", "cab" — leave blank and just save if
   you don't want to type anything)
4. Add action **"Get Contents of URL"**:
   - URL: `http://<your-backend-url>/api/expenses`
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
no app needs to open.

## 4. Deploying so it works away from home Wi-Fi (optional, still free)

Options with free tiers: **Render**, **Railway**, or **Fly.io** for the
backend (point the Shortcut and `frontend/app.js`'s `API_BASE` at the deployed
URL instead of `localhost`). This step costs nothing at low personal-use
volume but does require creating an account with one of those providers.

## Project structure

```
expense-tracker/
├── backend/
│   ├── server.js       # the API
│   ├── data/expenses.json   # your data, plain JSON
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── manifest.json   # PWA metadata
│   └── sw.js            # service worker (offline app shell)
├── README.md
└── CONCEPTS.md
```
