# Concepts used in this project

A quick tour of the ideas behind the code, in the order you'll run into them.

## Client-server architecture

The app is split into two independent pieces that talk over HTTP:

- The **backend** (`server.js`) owns the data and the rules — it's the only
  thing allowed to read/write `expenses.json`.
- The **frontend** (the PWA) and the **iPhone Shortcut** are both just
  *clients* — they never touch the file directly, they only ask the backend
  to do things on their behalf.

This split is why the Shortcut can save data without "knowing" anything about
your app's UI, and why you could swap the frontend for a completely different
one later without touching the backend at all.

## REST API / HTTP methods

The backend exposes a small set of URLs ("endpoints"), each responding to a
specific HTTP method:

| Method | URL | Purpose |
|---|---|---|
| GET | `/api/expenses?month=2026-09` | read data (safe, no side effects) |
| POST | `/api/expenses` | create a new expense |
| DELETE | `/api/expenses/:id` | remove one |

This GET/POST/DELETE convention is called **REST**, and it's the most common
shape for web APIs — once you recognize it here, you'll recognize it in every
other API you touch.

## JSON

Every request/response body is **JSON** (`{"amount": 12.5, "category": "Food"}`)
— a text format for structured data that both JavaScript (frontend, Shortcuts)
and Node.js (backend) can read/write natively. It's the universal language
client and server use to exchange the actual expense data.

## Express (a web framework)

`server.js` uses **Express**, a library that turns "when a POST request hits
`/api/expenses`, run this function" into a few lines of code instead of
hand-parsing raw HTTP. `app.post('/api/expenses', ...)` is the whole
pattern — this is the most common way to write a Node.js backend.

## File-based persistence (instead of a database)

Rather than setting up Postgres/MySQL, expenses are stored in a plain
`expenses.json` array on disk, read and rewritten on every change. For a
single-user personal project this is simpler, free, and good enough — the
tradeoff is it wouldn't scale to many simultaneous users, which doesn't apply
here.

## API keys (a simple form of authentication)

The `x-api-key` header is a shared secret: your Shortcut and your frontend
both send it, and `requireApiKey` in `server.js` rejects any write request
that doesn't include the right value. This is a lightweight stand-in for a
full login system — appropriate because only you are ever meant to write
data.

## CORS (Cross-Origin Resource Sharing)

Browsers block a webpage from calling an API on a different
domain/port unless that API explicitly allows it. `app.use(cors())` in
`server.js` tells the browser "requests from other origins are fine" — without
it, your frontend (served from one port) couldn't fetch from the backend
(running on another).

## Environment variables

`process.env.API_KEY` and `process.env.PORT` let you configure the app
(secrets, ports) without hardcoding them into the source — you set them when
you start the process (`API_KEY=xyz npm start`) instead of editing code. This
is also how you'd keep secrets out of anything you eventually commit to git.

## PWA: manifest + service worker

Two files make a plain webpage installable like an app:

- **`manifest.json`** declares metadata (name, icon, colors) so iOS Safari's
  "Add to Home Screen" makes something that looks and launches like a real app
  instead of a bookmark.
- **`sw.js`** (a *service worker*) is a background script the browser runs
  even when your site isn't open. Here it caches the HTML/CSS/JS ("app
  shell") so the app opens instantly and works offline — while deliberately
  *not* caching `/api/` calls, since expense data must always be fresh.

## Why the Back Tap logic lives in Shortcuts, not in code

iOS never gives web pages (or even most native apps) a hook into the Back Tap
gesture — it's handled entirely inside the OS's Accessibility settings. The
Shortcuts app is Apple's own automation tool, and its **"Get Contents of
URL"** action is just... an HTTP client, the same way `fetch()` is in
JavaScript. So "Back Tap → native popup → saved to your tracker" is really:
*OS gesture → Shortcuts app → same REST API your PWA uses* — no custom iOS
code required.
