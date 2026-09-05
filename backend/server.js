const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'change-me-please';
const DATA_FILE = path.join(__dirname, 'data', 'expenses.json');

app.use(cors());
app.use(express.json());

function readExpenses() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, '[]');
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw || '[]');
}

function writeExpenses(expenses) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(expenses, null, 2));
}

// Pay-cycle logic: "months" here run 7th -> 6th of the next month (payday),
// not calendar months. A cycle is identified by its start date, e.g. a date
// of 2026-09-20 falls in the cycle that starts 2026-09-07 and ends
// 2026-10-06; a date of 2026-09-03 falls in the cycle starting 2026-08-07.
const PAY_DAY = 7;

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function cycleStartForDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDate();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), PAY_DAY));
  if (day < PAY_DAY) {
    start.setUTCMonth(start.getUTCMonth() - 1);
  }
  return toISODate(start);
}

// Every write (POST/DELETE) must present the shared secret so only your
// Shortcut / your frontend can modify data. Reads are left open since this
// is a personal, single-user project.
function requireApiKey(req, res, next) {
  const key = req.header('x-api-key');
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// GET /api/expenses?start=2026-09-07&end=2026-10-06  -> list + total for that
//   date range (inclusive). Used for pay-cycle views.
// GET /api/expenses                                  -> everything
app.get('/api/expenses', (req, res) => {
  const { start, end } = req.query;
  let expenses = readExpenses();

  if (start && end) {
    expenses = expenses.filter((e) => e.date >= start && e.date <= end);
  }

  expenses.sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  res.json({ expenses, total, count: expenses.length });
});

// GET /api/expenses/summary -> total spent per pay cycle, for a "history" view
app.get('/api/expenses/summary', (req, res) => {
  const expenses = readExpenses();
  const byCycle = {};

  for (const e of expenses) {
    const cycleStart = cycleStartForDate(e.date);
    byCycle[cycleStart] = (byCycle[cycleStart] || 0) + e.amount;
  }

  const summary = Object.entries(byCycle)
    .map(([cycleStart, total]) => ({ cycleStart, total }))
    .sort((a, b) => (a.cycleStart < b.cycleStart ? 1 : -1));

  res.json({ summary });
});

app.post('/api/expenses', requireApiKey, (req, res) => {
  const { amount, category, date, note } = req.body;

  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return res.status(400).json({ error: 'amount must be a number' });
  }

  const expense = {
    id: crypto.randomUUID(),
    amount,
    category: category || 'Uncategorized',
    note: note || '',
    date: date || new Date().toISOString().slice(0, 10), // "YYYY-MM-DD"
    createdAt: new Date().toISOString(),
  };

  const expenses = readExpenses();
  expenses.push(expense);
  writeExpenses(expenses);

  res.status(201).json(expense);
});

app.delete('/api/expenses/:id', requireApiKey, (req, res) => {
  const expenses = readExpenses();
  const filtered = expenses.filter((e) => e.id !== req.params.id);

  if (filtered.length === expenses.length) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  writeExpenses(filtered);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Expense tracker API running on http://localhost:${PORT}`);
});
