// Deployed backend on Render — works from anywhere, not just home Wi-Fi.
const API_BASE = 'https://expense-tracker-7vtl.onrender.com';

// Must match the API_KEY the backend was started with, and the value used
// in the iPhone Shortcut's "x-api-key" header. Since this is a personal,
// single-user project, it's hardcoded here rather than prompted each time.
const API_KEY = 'exp-tracker-9f3a2c1d7e';

// "Months" here run payday-to-payday (7th of one month through the 6th of
// the next), not calendar months.
const PAY_DAY = 7;

const BUDGET_KEY = 'expenseTrackerBudget';

// ---- Element refs -------------------------------------------------------

const viewHistory = document.getElementById('view-history');
const viewTrack = document.getElementById('view-track');
const viewAnalytics = document.getElementById('view-analytics');
const viewCash = document.getElementById('view-cash');
const tabHistoryBtn = document.getElementById('tab-history');
const tabTrackBtn = document.getElementById('tab-track');
const tabAnalyticsBtn = document.getElementById('tab-analytics');
const openCashBtn = document.getElementById('open-cash-btn');
const cashBackBtn = document.getElementById('cash-back-btn');

const cycleLabel = document.getElementById('cycle-label');
const prevCycleBtn = document.getElementById('prev-cycle');
const nextCycleBtn = document.getElementById('next-cycle');
const totalAmount = document.getElementById('total-amount');
const expenseList = document.getElementById('expense-list');
const statusMessage = document.getElementById('status-message');
const budgetLeftBar = document.getElementById('budget-left-bar');
const budgetLeftAmount = document.getElementById('budget-left-amount');

const trackAmountDisplay = document.getElementById('track-amount-display');
const trackNoteInput = document.getElementById('track-note');
const trackDateInput = document.getElementById('track-date');
const trackDatePlaceholder = document.getElementById('track-date-placeholder');
const trackSubmitBtn = document.getElementById('track-submit');
const trackStatus = document.getElementById('track-status');
const keypadButtons = document.querySelectorAll('.keypad button');

const rangeButtons = document.querySelectorAll('.range-btn');
const analyticsRangeLabel = document.getElementById('analytics-range-label');
const analyticsTotalLabel = document.getElementById('analytics-total-label');
const analyticsTotalAmount = document.getElementById('analytics-total-amount');
const analyticsBudgetCard = document.getElementById('analytics-budget-card');
const analyticsBudgetLeft = document.getElementById('analytics-budget-left');
const analyticsMonthlyList = document.getElementById('analytics-monthly-list');

const settingsBtns = document.querySelectorAll('.settings-btn');
const settingsModal = document.getElementById('settings-modal');
const budgetInput = document.getElementById('budget-input');
const settingsSaveBtn = document.getElementById('settings-save');
const settingsCancelBtn = document.getElementById('settings-cancel');

const prevCashCycleBtn = document.getElementById('prev-cash-cycle');
const nextCashCycleBtn = document.getElementById('next-cash-cycle');
const cashCycleLabel = document.getElementById('cash-cycle-label');
const cashTotalAmount = document.getElementById('cash-total-amount');
const cashCarried = document.getElementById('cash-carried');
const cashSalary = document.getElementById('cash-salary');
const cashInvestmentOut = document.getElementById('cash-investment-out');
const cashExpensesOut = document.getElementById('cash-expenses-out');
const cashSalaryInput = document.getElementById('cash-salary-input');
const cashInvestmentInput = document.getElementById('cash-investment-input');
const cashInvestmentSaveBtn = document.getElementById('cash-investment-save');
const cashInvestmentStatus = document.getElementById('cash-investment-status');
const cashTotalInvested = document.getElementById('cash-total-invested');

// ---- State ---------------------------------------------------------------

// The pay cycle currently on screen in History, tracked as its start date.
let currentCycleStart = cycleStartForDate(new Date());
let currentRange = 'week';
let trackAmountStr = '';

// The pay cycle currently on screen in Cash in Hand.
let cashCycleStart = cycleStartForDate(new Date());

// ---- Date helpers ----------------------------------------------------------

function pad(n) {
  return String(n).padStart(2, '0');
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Given any date, find the start of the pay cycle (7th -> 6th) it falls into.
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

// Monday-start week.
function weekStartForDate(date) {
  const day = date.getDay(); // 0 = Sun ... 6 = Sat
  const diffFromMonday = (day + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - diffFromMonday);
}

function weekEndForStart(start) {
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
}

function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${Math.abs(n).toFixed(2)}`;
}

function formatRangeLabel(start, end) {
  const opts = { day: 'numeric', month: 'short' };
  const startStr = start.toLocaleDateString('en-IN', opts);
  const endStr = end.toLocaleDateString('en-IN', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function formatDateBadge(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

async function fetchTotalForRange(start, end) {
  const res = await fetch(
    `${API_BASE}/api/expenses?start=${toISODate(start)}&end=${toISODate(end)}`
  );
  const data = await res.json();
  return data;
}

async function fetchSummary() {
  const res = await fetch(`${API_BASE}/api/expenses/summary`);
  const data = await res.json();
  return data.summary;
}

async function fetchCashMonths() {
  const res = await fetch(`${API_BASE}/api/cash-months`);
  const data = await res.json();
  return data.months;
}

// ---- Budget (stored locally on this device) --------------------------------

function getBudget() {
  const v = parseFloat(localStorage.getItem(BUDGET_KEY));
  return Number.isNaN(v) ? 0 : v;
}

function setBudget(v) {
  localStorage.setItem(BUDGET_KEY, String(v));
}

// ---- History view (read-only, grouped by date) ------------------------------

async function loadCurrentCycle() {
  const start = currentCycleStart;
  const end = cycleEndForStart(start);
  cycleLabel.textContent = formatRangeLabel(start, end);

  statusMessage.textContent = 'Loading...';
  try {
    const data = await fetchTotalForRange(start, end);
    renderExpenses(data.expenses, data.total);
    budgetLeftAmount.textContent = formatMoney(getBudget() - data.total);
    statusMessage.textContent = '';
  } catch (err) {
    statusMessage.textContent = 'Could not reach the server. Is the backend running?';
  }
}

function renderExpenses(expenses, total) {
  totalAmount.textContent = formatMoney(total);
  expenseList.innerHTML = '';

  if (expenses.length === 0) {
    expenseList.innerHTML = '<div class="expense-item">No expenses this pay cycle yet.</div>';
    return;
  }

  // expenses arrive sorted by date descending, so entries with the same
  // date are already adjacent — group them under one date badge each.
  let currentGroup = null;
  let currentDate = null;

  for (const e of expenses) {
    if (e.date !== currentDate) {
      currentDate = e.date;
      const group = document.createElement('div');
      group.className = 'date-group';
      group.innerHTML = `
        <span class="date-badge">${formatDateBadge(e.date)}</span>
        <ul class="expense-list"></ul>
      `;
      expenseList.appendChild(group);
      currentGroup = group.querySelector('ul');
    }

    const li = document.createElement('li');
    li.className = 'expense-item-wrapper';
    li.innerHTML = `
      <div class="expense-item-actions">
        <button class="delete-btn" data-id="${e.id}">Delete</button>
      </div>
      <div class="expense-item">
        <div class="meta">
          <span class="category">${e.note || 'Expense'}</span>
        </div>
        <div>
          <span class="amount">${formatMoney(e.amount)}</span>
        </div>
      </div>
    `;
    currentGroup.appendChild(li);

    const content = li.querySelector('.expense-item');
    const deleteBtn = li.querySelector('.delete-btn');
    attachSwipeToDelete(content, deleteBtn);
  }
}

// ---- Swipe-to-delete (History list items) -----------------------------------

const SWIPE_REVEAL = 84;
let openSwipeItem = null;

function closeSwipeItem(el) {
  el.style.transform = 'translateX(0)';
  el.dataset.open = 'false';
  if (openSwipeItem === el) openSwipeItem = null;
}

function attachSwipeToDelete(contentEl, deleteBtn) {
  let startX = 0;
  let startY = 0;
  let startTranslate = 0;
  let dragging = false;
  let isHorizontal = null;

  function currentTranslate() {
    const match = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(contentEl.style.transform);
    return match ? parseFloat(match[1]) : 0;
  }

  contentEl.addEventListener(
    'touchstart',
    (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTranslate = currentTranslate();
      dragging = true;
      isHorizontal = null;
    },
    { passive: true }
  );

  contentEl.addEventListener(
    'touchmove',
    (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (isHorizontal === null) {
        isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (!isHorizontal) return;

      e.preventDefault();
      const next = Math.max(-SWIPE_REVEAL, Math.min(0, startTranslate + dx));
      contentEl.style.transition = 'none';
      contentEl.style.transform = `translateX(${next}px)`;
    },
    { passive: false }
  );

  contentEl.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    contentEl.style.transition = '';
    if (!isHorizontal) return;

    const shouldOpen = currentTranslate() < -SWIPE_REVEAL / 2;
    if (shouldOpen) {
      if (openSwipeItem && openSwipeItem !== contentEl) closeSwipeItem(openSwipeItem);
      contentEl.style.transform = `translateX(-${SWIPE_REVEAL}px)`;
      contentEl.dataset.open = 'true';
      openSwipeItem = contentEl;
    } else {
      closeSwipeItem(contentEl);
    }
  });

  // Tapping the content while it's open just closes it, instead of doing
  // nothing — a natural way to dismiss without hitting the delete button.
  contentEl.addEventListener('click', () => {
    if (contentEl.dataset.open === 'true') closeSwipeItem(contentEl);
  });

  deleteBtn.addEventListener('click', () => deleteExpense(deleteBtn.dataset.id));
}

async function deleteExpense(id) {
  await fetch(`${API_BASE}/api/expenses/${id}`, {
    method: 'DELETE',
    headers: { 'x-api-key': API_KEY },
  });
  loadCurrentCycle();
}

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

// ---- Track view (keypad quick-entry) ----------------------------------------

function updateTrackDisplay() {
  trackAmountDisplay.textContent = `₹${trackAmountStr === '' ? '0' : trackAmountStr}`;
}

function pressDigit(d) {
  const dotIndex = trackAmountStr.indexOf('.');
  if (dotIndex !== -1 && trackAmountStr.length - dotIndex - 1 >= 2) return;
  trackAmountStr = trackAmountStr === '0' ? d : trackAmountStr + d;
  updateTrackDisplay();
}

function pressDot() {
  if (trackAmountStr.includes('.')) return;
  trackAmountStr = (trackAmountStr === '' ? '0' : trackAmountStr) + '.';
  updateTrackDisplay();
}

function pressBackspace() {
  trackAmountStr = trackAmountStr.slice(0, -1);
  updateTrackDisplay();
}

function updateTrackDatePlaceholder() {
  const hasValue = Boolean(trackDateInput.value);
  trackDatePlaceholder.hidden = hasValue;
  trackDateInput.classList.toggle('has-value', hasValue);
}

trackDateInput.addEventListener('input', updateTrackDatePlaceholder);

keypadButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key;
    if (key === 'back') pressBackspace();
    else if (key === '.') pressDot();
    else pressDigit(key);
  });
});

trackSubmitBtn.addEventListener('click', async () => {
  const amount = parseFloat(trackAmountStr);
  if (!trackAmountStr || Number.isNaN(amount) || amount <= 0) {
    trackStatus.textContent = 'Enter an amount first';
    return;
  }

  trackStatus.textContent = 'Saving...';
  try {
    const res = await fetch(`${API_BASE}/api/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        amount,
        note: trackNoteInput.value,
        date: trackDateInput.value || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }

    trackAmountStr = '';
    trackNoteInput.value = '';
    trackDateInput.value = '';
    updateTrackDisplay();
    updateTrackDatePlaceholder();
    trackStatus.textContent = 'Saved ✓';
    setTimeout(() => {
      trackStatus.textContent = '';
    }, 1500);
  } catch (err) {
    trackStatus.textContent = err.message;
  }
});

// ---- Analytics view ---------------------------------------------------------

function updateRangeButtonsUI() {
  rangeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.range === currentRange);
  });
}

async function loadAnalytics() {
  analyticsBudgetCard.hidden = true;
  analyticsMonthlyList.hidden = true;
  analyticsMonthlyList.innerHTML = '';

  if (currentRange === 'week') {
    const start = weekStartForDate(new Date());
    const end = weekEndForStart(start);
    analyticsRangeLabel.textContent = formatRangeLabel(start, end);
    analyticsTotalLabel.textContent = 'Spent this week';
    const data = await fetchTotalForRange(start, end);
    analyticsTotalAmount.textContent = formatMoney(data.total);
    return;
  }

  if (currentRange === 'month') {
    const start = cycleStartForDate(new Date());
    const end = cycleEndForStart(start);
    analyticsRangeLabel.textContent = formatRangeLabel(start, end);
    analyticsTotalLabel.textContent = 'Spent this month';
    const data = await fetchTotalForRange(start, end);
    analyticsTotalAmount.textContent = formatMoney(data.total);

    const budget = getBudget();
    analyticsBudgetCard.hidden = false;
    analyticsBudgetLeft.textContent = formatMoney(budget - data.total);
    return;
  }

  // year
  const year = new Date().getFullYear();
  analyticsRangeLabel.textContent = `Jan – Dec ${year}`;
  analyticsTotalLabel.textContent = 'Spent this year';

  const summary = await fetchSummary();
  const yearEntries = summary.filter((s) => s.cycleStart.startsWith(String(year)));
  const yearTotal = yearEntries.reduce((sum, s) => sum + s.total, 0);
  analyticsTotalAmount.textContent = formatMoney(yearTotal);

  analyticsMonthlyList.hidden = false;
  if (yearEntries.length === 0) {
    analyticsMonthlyList.innerHTML = '<li class="expense-item">No expenses yet this year.</li>';
  } else {
    for (const entry of yearEntries) {
      const start = new Date(`${entry.cycleStart}T00:00:00`);
      const end = cycleEndForStart(start);
      const li = document.createElement('li');
      li.className = 'expense-item';
      li.innerHTML = `
        <div class="meta">
          <span class="category">${formatRangeLabel(start, end)}</span>
        </div>
        <div>
          <span class="amount">${formatMoney(entry.total)}</span>
        </div>
      `;
      analyticsMonthlyList.appendChild(li);
    }
  }
}

rangeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    currentRange = btn.dataset.range;
    updateRangeButtonsUI();
    loadAnalytics();
  });
});

// ---- Cash in Hand view -------------------------------------------------------
//
// Cash in hand is a running ledger, carried forward every pay cycle:
//   this month's cash = last month's leftover + salary − investment − expenses
// Both salary and investment are single editable numbers per month, stored
// in the `cash_investments` table, defaulting to 0 for any month you haven't
// filled in. Expenses reuse the same pay-cycle totals already used elsewhere.

async function loadCash() {
  const start = cashCycleStart;
  const end = cycleEndForStart(start);
  cashCycleLabel.textContent = formatRangeLabel(start, end);

  const [summary, months] = await Promise.all([fetchSummary(), fetchCashMonths()]);
  const expenseByMonth = new Map(summary.map((s) => [s.cycleStart, s.total]));
  const salaryByMonth = new Map(months.map((m) => [m.cycle_start, Number(m.salary)]));
  const investmentByMonth = new Map(months.map((m) => [m.cycle_start, Number(m.investment)]));

  const targetKey = toISODate(cashCycleStart);

  // Walk forward month by month from the earliest month with any data (or
  // the target month itself, if there's no data yet) up to the month being
  // viewed, accumulating the running balance.
  let cursor = cashCycleStart;
  const allKeys = [...expenseByMonth.keys(), ...salaryByMonth.keys()];
  if (allKeys.length > 0) {
    const earliestKey = allKeys.sort()[0];
    const earliestDate = new Date(`${earliestKey}T00:00:00`);
    if (earliestDate < cursor) cursor = earliestDate;
  }

  let balance = 0;
  let monthBreakdown = null;

  while (cursor <= cashCycleStart) {
    const key = toISODate(cursor);
    const expense = expenseByMonth.get(key) || 0;
    const salary = salaryByMonth.get(key) || 0;
    const investment = investmentByMonth.get(key) || 0;
    const carriedIn = balance;
    balance = balance + salary - investment - expense;

    if (key === targetKey) {
      monthBreakdown = { carriedIn, salary, investment, expense, balance };
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, PAY_DAY);
  }

  cashTotalAmount.textContent = formatMoney(monthBreakdown.balance);
  cashCarried.textContent = formatMoney(monthBreakdown.carriedIn);
  cashSalary.textContent = formatMoney(monthBreakdown.salary);
  cashInvestmentOut.textContent = formatMoney(monthBreakdown.investment);
  cashExpensesOut.textContent = formatMoney(monthBreakdown.expense);

  cashSalaryInput.value = salaryByMonth.get(targetKey) || '';
  cashInvestmentInput.value = investmentByMonth.get(targetKey) || '';

  const totalInvested = months.reduce((sum, m) => sum + Number(m.investment), 0);
  cashTotalInvested.textContent = formatMoney(totalInvested);
}

cashInvestmentSaveBtn.addEventListener('click', async () => {
  const salary = parseFloat(cashSalaryInput.value) || 0;
  const investment = parseFloat(cashInvestmentInput.value) || 0;
  cashInvestmentStatus.textContent = 'Saving...';
  try {
    const res = await fetch(`${API_BASE}/api/cash-months`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ cycleStart: toISODate(cashCycleStart), salary, investment }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }

    cashInvestmentStatus.textContent = 'Saved ✓';
    setTimeout(() => {
      cashInvestmentStatus.textContent = '';
    }, 1500);
    loadCash();
  } catch (err) {
    cashInvestmentStatus.textContent = err.message;
  }
});

prevCashCycleBtn.addEventListener('click', () => {
  cashCycleStart = new Date(cashCycleStart.getFullYear(), cashCycleStart.getMonth() - 1, PAY_DAY);
  loadCash();
});

nextCashCycleBtn.addEventListener('click', () => {
  cashCycleStart = new Date(cashCycleStart.getFullYear(), cashCycleStart.getMonth() + 1, PAY_DAY);
  loadCash();
});

openCashBtn.addEventListener('click', () => setActiveView('cash'));
cashBackBtn.addEventListener('click', () => setActiveView('history'));

// ---- Bottom tab navigation ---------------------------------------------------

function setActiveView(view) {
  viewHistory.hidden = view !== 'history';
  viewTrack.hidden = view !== 'track';
  viewAnalytics.hidden = view !== 'analytics';
  viewCash.hidden = view !== 'cash';
  budgetLeftBar.hidden = view !== 'history';
  tabHistoryBtn.classList.toggle('active', view === 'history');
  tabTrackBtn.classList.toggle('active', view === 'track');
  tabAnalyticsBtn.classList.toggle('active', view === 'analytics');

  if (view === 'history') loadCurrentCycle();
  if (view === 'analytics') loadAnalytics();
  if (view === 'cash') loadCash();
}

tabHistoryBtn.addEventListener('click', () => setActiveView('history'));
tabTrackBtn.addEventListener('click', () => setActiveView('track'));
tabAnalyticsBtn.addEventListener('click', () => setActiveView('analytics'));

// ---- Settings / budget -----------------------------------------------------

settingsBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    budgetInput.value = getBudget() || '';
    settingsModal.hidden = false;
  });
});

settingsCancelBtn.addEventListener('click', () => {
  settingsModal.hidden = true;
});

settingsSaveBtn.addEventListener('click', () => {
  setBudget(parseFloat(budgetInput.value) || 0);
  settingsModal.hidden = true;
  if (!viewHistory.hidden) loadCurrentCycle();
  if (!viewAnalytics.hidden && currentRange === 'month') {
    loadAnalytics();
  }
});

// ---- Init -----------------------------------------------------------------

updateRangeButtonsUI();
updateTrackDisplay();
updateTrackDatePlaceholder();
setActiveView('history');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
