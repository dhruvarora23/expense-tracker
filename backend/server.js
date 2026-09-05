require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'change-me-please';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.use(cors());
app.use(express.json());

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
app.get('/api/expenses', async (req, res) => {
  const { start, end } = req.query;

  let query = supabase.from('expenses').select('*').order('date', { ascending: false });
  if (start && end) {
    query = query.gte('date', start).lte('date', end);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const total = data.reduce((sum, e) => sum + Number(e.amount), 0);
  res.json({ expenses: data, total, count: data.length });
});

// GET /api/expenses/summary -> total spent per pay cycle, for a "history" view
app.get('/api/expenses/summary', async (req, res) => {
  const { data, error } = await supabase.from('expenses').select('amount, date');
  if (error) return res.status(500).json({ error: error.message });

  const byCycle = {};
  for (const e of data) {
    const cycleStart = cycleStartForDate(e.date);
    byCycle[cycleStart] = (byCycle[cycleStart] || 0) + Number(e.amount);
  }

  const summary = Object.entries(byCycle)
    .map(([cycleStart, total]) => ({ cycleStart, total }))
    .sort((a, b) => (a.cycleStart < b.cycleStart ? 1 : -1));

  res.json({ summary });
});

app.post('/api/expenses', requireApiKey, async (req, res) => {
  const { amount, date, note } = req.body;

  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return res.status(400).json({ error: 'amount must be a number' });
  }

  const expense = {
    amount,
    note: note || '',
    date: date || new Date().toISOString().slice(0, 10), // "YYYY-MM-DD"
  };

  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json(data);
});

app.delete('/api/expenses/:id', requireApiKey, async (req, res) => {
  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', req.params.id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Expense tracker API running on http://localhost:${PORT}`);
});
