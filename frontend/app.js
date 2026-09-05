// Change this once you deploy the backend somewhere public (see README).
const API_BASE = 'http://localhost:3000';

// Must match the API_KEY the backend was started with, and the value used
// in the iPhone Shortcut's "x-api-key" header. Since this is a personal,
// single-user project, it's hardcoded here rather than prompted each time.
const API_KEY = 'exp-tracker-9f3a2c1d7e';

// "Months" here run payday-to-payday (7th of one month through the 6th of
// the next), not calendar months.
const PAY_DAY = 7;

const cycleLabel = document.getElementById('cycle-label');
const prevCycleBtn = document.getElementById('prev-cycle');
const nextCycleBtn = document.getElementById('next-cycle');
const totalAmount = document.getElementById('total-amount');
const expenseList = document.getElementById('expense-list');
const addForm = document.getElementById('add-form');
const statusMessage = document.getElementById('status-message');
const dateInput = document.getElementById('date');

// The cycle currently on screen, tracked as its start date.
let currentCycleStart = cycleStartForDate(new Date());

function pad(n) {
  return String(n).padStart(2, '0');
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Given any date, find the start of the pay cycle it falls into.
function cycleStartForDate(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), PAY_DAY);
  if (date.getDate() < PAY_DAY) {
    start.setMonth(start.getMonth() - 1);
  }
  return start;
}

function cycleEndForStart(start) {
  const end = new Date(start.getFullYear(), start.getMonth() + 1, PAY_DAY);
  end.setDate(end.getDate() - 1);
  return end;
}

function formatMoney(n) {
  return `₹${n.toFixed(2)}`;
}

function formatCycleLabel(start, end) {
  const opts = { day: 'numeric', month: 'short' };
  const startStr = start.toLocaleDateString('en-IN', opts);
  const endStr = end.toLocaleDateString('en-IN', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

async function loadCurrentCycle() {
  const start = currentCycleStart;
  const end = cycleEndForStart(start);
  cycleLabel.textContent = formatCycleLabel(start, end);

  statusMessage.textContent = 'Loading...';
  try {
    const res = await fetch(
      `${API_BASE}/api/expenses?start=${toISODate(start)}&end=${toISODate(end)}`
    );
    const data = await res.json();
    renderExpenses(data.expenses, data.total);
    statusMessage.textContent = '';
  } catch (err) {
    statusMessage.textContent = 'Could not reach the server. Is the backend running?';
  }
}

function renderExpenses(expenses, total) {
  totalAmount.textContent = formatMoney(total);
  expenseList.innerHTML = '';

  if (expenses.length === 0) {
    expenseList.innerHTML = '<li class="expense-item">No expenses this pay cycle yet.</li>';
    return;
  }

  for (const e of expenses) {
    const li = document.createElement('li');
    li.className = 'expense-item';
    li.innerHTML = `
      <div class="meta">
        <span class="category">${e.category}${e.note ? ' — ' + e.note : ''}</span>
        <span class="date">${e.date}</span>
      </div>
      <div>
        <span class="amount">${formatMoney(e.amount)}</span>
        <button class="delete-btn" data-id="${e.id}">Delete</button>
      </div>
    `;
    expenseList.appendChild(li);
  }

  expenseList.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteExpense(btn.dataset.id));
  });
}

async function deleteExpense(id) {
  await fetch(`${API_BASE}/api/expenses/${id}`, {
    method: 'DELETE',
    headers: { 'x-api-key': API_KEY },
  });
  loadCurrentCycle();
}

addForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const amount = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value;
  const note = document.getElementById('note').value;
  const date = dateInput.value || undefined;

  try {
    const res = await fetch(`${API_BASE}/api/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ amount, category, note, date }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }

    addForm.reset();
    loadCurrentCycle();
  } catch (err) {
    statusMessage.textContent = err.message;
  }
});

prevCycleBtn.addEventListener('click', () => {
  currentCycleStart = new Date(
    currentCycleStart.getFullYear(),
    currentCycleStart.getMonth() - 1,
    PAY_DAY
  );
  loadCurrentCycle();
});

nextCycleBtn.addEventListener('click', () => {
  currentCycleStart = new Date(
    currentCycleStart.getFullYear(),
    currentCycleStart.getMonth() + 1,
    PAY_DAY
  );
  loadCurrentCycle();
});

loadCurrentCycle();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
