// ─── Per-User Storage ─────────────────────────────────────────────────────────
// Returns a key unique to the logged-in user so each account's
// transactions are completely isolated from every other account.
function getUserStorageKey() {
  if (window.AppAuth) {
    const user = window.AppAuth.getCurrentUser();
    if (user && user.email) {
      return window.AppAuth.getUserTransactionsKey(user.email);
    }
  }
  return "ff_transactions_guest"; // safety fallback (should never be reached)
}

const themeKey = "fintrack-theme";

// Default transactions shown ONLY when a brand-new user has none yet
const defaultTransactions = [
  { id: 1, title: "Salary",            category: "Income",        type: "income",  amount: 60000, date: "2026-04-01", status: "Completed" },
  { id: 2, title: "Swiggy",            category: "Food",          type: "expense", amount: 450,   date: "2026-04-01", status: "Expense"   },
  { id: 3, title: "Electricity Bill",  category: "Bills",         type: "expense", amount: 2300,  date: "2026-03-31", status: "Pending"   },
  { id: 4, title: "Freelance Payment", category: "Income",        type: "income",  amount: 18000, date: "2026-03-30", status: "Completed" },
  { id: 5, title: "Netflix",           category: "Entertainment", type: "expense", amount: 649,   date: "2026-03-29", status: "Expense"   },
];

// These are set inside initializeApp() after auth is confirmed
let transactions  = [];
let currentFilter = "all";
let searchTerm    = "";
let expenseChart  = null;

// DOM refs (set in initializeApp)
let tableBody, searchInput, transactionForm, themeToggle;

// ─── Entry Point ──────────────────────────────────────────────────────────────
// Wait for DOM + auth before doing anything
document.addEventListener("DOMContentLoaded", function () {
  // Auth guard — redirect if no one is logged in
  if (!window.AppAuth || !AppAuth.getCurrentUser()) {
    window.location.href = "login.html";
    return;
  }

  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      AppAuth.clearCurrentUser();
      window.location.href = "login.html";
    });
  }

  // Populate logged-in user's name + initials in sidebar
  populateUserProfile();

  // Cache DOM refs
  tableBody       = document.getElementById("transactionsTableBody");
  searchInput     = document.getElementById("searchInput");
  transactionForm = document.getElementById("transactionForm");
  themeToggle     = document.getElementById("themeToggle");

  initializeApp();
});

// ─── App Init ────────────────────────────────────────────────────────────────

function initializeApp() {
  applyTheme(loadTheme());
  setDefaultDate();
  bindEvents();
  transactions = loadTransactions();
  renderDashboard();
}

// ─── User Profile in Sidebar ─────────────────────────────────────────────────

function populateUserProfile() {
  if (!window.AppAuth) return;
  const user = window.AppAuth.getCurrentUser();
  if (!user) return;

  // Show real name in sidebar footer
  const nameEl   = document.querySelector(".sidebar-profile-name");
  const avatarEl = document.querySelector(".sidebar-profile-avatar");

  if (nameEl) nameEl.textContent = user.name || user.email;

  if (avatarEl) {
    // Build initials: e.g. "Demo User" → "DU", "alice" → "AL"
    const initials = (user.name || user.email)
      .split(/[\s@]+/)
      .filter(Boolean)
      .map((word) => word[0].toUpperCase())
      .slice(0, 2)
      .join("");
    avatarEl.textContent = initials;
  }
}

// ─── Storage: Per-User ────────────────────────────────────────────────────────

function loadTransactions() {
  const key   = getUserStorageKey();
  const saved = localStorage.getItem(key);

  if (!saved) {
    // First-time user — seed with defaults and save under their key
    localStorage.setItem(key, JSON.stringify(defaultTransactions));
    return [...defaultTransactions];
  }

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [...defaultTransactions];

    const safe = parsed.map(normalizeTransaction).filter(Boolean);
    if (!safe.length) {
      localStorage.setItem(key, JSON.stringify(defaultTransactions));
      return [...defaultTransactions];
    }

    return safe;
  } catch {
    localStorage.setItem(key, JSON.stringify(defaultTransactions));
    return [...defaultTransactions];
  }
}

function saveTransactions() {
  // Always saves to the current user's private key
  localStorage.setItem(getUserStorageKey(), JSON.stringify(transactions));
}

// ─── Render Helpers ───────────────────────────────────────────────────────────

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    renderTransactions();
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderTransactions();
    });
  });

  transactionForm.addEventListener("submit", handleFormSubmit);
  themeToggle.addEventListener("click", toggleTheme);
}

function renderDashboard() {
  renderSummaryCards();
  renderChart();
  renderQuickStats();
  renderTransactions();
}

function renderSummaryCards() {
  const totals = calculateTotals(transactions);

  document.querySelector('[data-summary="balance"]').textContent   = formatCurrency(totals.income - totals.expenses);
  document.querySelector('[data-summary="income"]').textContent    = formatCurrency(totals.income);
  document.querySelector('[data-summary="expenses"]').textContent  = formatCurrency(totals.expenses);
  document.querySelector('[data-summary="savings"]').textContent   = formatCurrency(Math.max(totals.income - totals.expenses, 0));

  document.querySelector('[data-summary-note="balance"]').textContent  = `${totals.income >= totals.expenses ? "Healthy" : "Needs attention"} cash position`;
  document.querySelector('[data-summary-note="income"]').textContent   = `${transactions.filter((t) => t.type === "income").length} income entries`;
  document.querySelector('[data-summary-note="expenses"]').textContent = `${transactions.filter((t) => t.type === "expense").length} expense entries`;
  document.querySelector('[data-summary-note="savings"]').textContent  = `${totals.income ? Math.round(((totals.income - totals.expenses) / totals.income) * 100) : 0}% of income retained`;
}

function renderTransactions() {
  const filtered = transactions.filter((t) => {
    const matchesFilter = currentFilter === "all" || t.type === currentFilter;
    const matchesSearch = t.title.toLowerCase().includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  if (!filtered.length) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 empty-state">No transactions match your filters.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered
    .map((t) => {
      const amountClass  = t.type === "income" ? "amount-positive" : "amount-negative";
      const signedAmount = t.type === "income" ? `+${formatCurrency(t.amount)}` : `-${formatCurrency(t.amount)}`;
      const statusClass  = getStatusClass(t.status);

      return `
        <tr>
          <td>
            <div class="fw-semibold">${escapeHtml(t.title)}</div>
            <small class="text-muted">${t.type === "income" ? "Money in" : "Money out"}</small>
          </td>
          <td>${escapeHtml(t.category)}</td>
          <td>${formatDate(t.date)}</td>
          <td class="${amountClass}">${signedAmount}</td>
          <td><span class="badge badge-status ${statusClass}">${t.status}</span></td>
          <td class="text-end">
            <div class="transaction-actions">
              <button class="btn btn-sm btn-outline-danger" type="button" data-delete-id="${t.id}">Delete</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  document.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => deleteTransaction(Number(btn.dataset.deleteId)));
  });
}

function renderChart() {
  const context              = document.getElementById("expenseChart");
  const categoryExpenseTotals = getCategoryExpenseTotals(transactions);

  if (expenseChart) expenseChart.destroy();

  const isDarkMode  = document.body.classList.contains("dark-mode");
  const borderColor = isDarkMode ? "#0f1b2d" : "#f4f6fb";
  const palette     = ["#f4b13b", "#46b8b0", "#4b8df0", "#a56be5", "#f09a52", "#f05d61", "#df5fa4"];

  expenseChart = new Chart(context, {
    type: "doughnut",
    data: {
      labels:   categoryExpenseTotals.labels,
      datasets: [{
        label:           "Expenses",
        data:            categoryExpenseTotals.values,
        backgroundColor: palette,
        borderColor,
        borderWidth:  2,
        hoverOffset:  6,
        cutout:       "64%",
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      layout: { padding: { top: 6, bottom: 4, left: 0, right: 0 } },
      plugins: {
        legend: {
          display:  true,
          position: "top",
          align:    "end",
          labels:   {
            usePointStyle: true,
            pointStyle:    "circle",
            boxWidth:  8,
            boxHeight: 8,
            padding:  14,
            color:    isDarkMode ? "#b7c5da" : "#7b8797",
            font:     { size: 12, weight: "600", family: "'Segoe UI', sans-serif" },
          },
        },
        tooltip: {
          mode:            "point",
          intersect:       true,
          backgroundColor: isDarkMode ? "rgba(20,35,55,0.96)" : "rgba(15,23,42,0.88)",
          titleColor:      isDarkMode ? "#e8f0ff" : "#122033",
          bodyColor:       isDarkMode ? "#a5d8ff" : "#2563eb",
          borderColor:     isDarkMode ? "rgba(96,165,250,0.3)" : "rgba(37,99,235,0.2)",
          borderWidth:     1,
          padding:         12,
          displayColors:   true,
          titleFont:  { size: 13, weight: "700", family: "'Segoe UI', sans-serif" },
          bodyFont:   { size: 14, weight: "600", family: "'Segoe UI', sans-serif" },
          callbacks:  { label: (item) => `${item.label}: ${formatCurrency(item.raw)}` },
          cornerRadius: 10,
        },
      },
    },
  });
}

function renderQuickStats() {
  const now = new Date();

  const monthTotal = transactions
    .filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const avgTransaction = transactions.length
    ? Math.round(transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length)
    : 0;

  const categoryCount  = new Set(transactions.map((t) => t.category)).size;
  const completedCount = transactions.filter((t) => t.status === "Completed").length;
  const pendingCount   = transactions.filter((t) => t.status === "Pending").length;

  const set = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  };

  set('[data-quick="month"]',      formatCurrency(monthTotal));
  set('[data-quick="avg"]',        formatCurrency(avgTransaction));
  set('[data-quick="categories"]', String(categoryCount));
  set('[data-quick="completed"]',  String(completedCount));
  set('[data-quick="pending"]',    String(pendingCount));
}

// ─── Transaction CRUD ─────────────────────────────────────────────────────────

function handleFormSubmit(event) {
  event.preventDefault();

  const titleInput    = document.getElementById("transactionTitle");
  const amountInput   = document.getElementById("transactionAmount");
  const categoryInput = document.getElementById("transactionCategory");
  const typeInput     = document.getElementById("transactionType");
  const dateInput     = document.getElementById("transactionDate");

  const title  = titleInput.value.trim();
  const amount = Number(amountInput.value);
  const category = categoryInput.value.trim();
  const type   = typeInput.value;
  const date   = dateInput.value;

  if (!validateFormInputs(titleInput, amountInput, title, amount)) return;

  const newTransaction = {
    id:       Date.now(),
    title,
    category: category || (type === "income" ? "Income" : "Expense"),
    type,
    amount,
    date:     date || new Date().toISOString().split("T")[0],
    status:   type === "income" ? "Completed" : "Expense",
  };

  transactions = [newTransaction, ...transactions];
  saveTransactions();
  renderDashboard();
  transactionForm.reset();
  setDefaultDate();

  const modalEl       = document.getElementById("transactionModal");
  const modalInstance = bootstrap.Modal.getInstance(modalEl);
  if (modalInstance) modalInstance.hide();
}

function validateFormInputs(titleInput, amountInput, title, amount) {
  titleInput.classList.remove("is-invalid");
  amountInput.classList.remove("is-invalid");

  let isValid = true;
  if (!title)  { titleInput.classList.add("is-invalid");  isValid = false; }
  if (!Number.isFinite(amount) || amount <= 0) { amountInput.classList.add("is-invalid"); isValid = false; }
  return isValid;
}

function deleteTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions();
  renderDashboard();
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function calculateTotals(list) {
  return list.reduce(
    (totals, t) => {
      if (t.type === "income") totals.income   += t.amount;
      else                     totals.expenses += t.amount;
      return totals;
    },
    { income: 0, expenses: 0 }
  );
}

function getCategoryExpenseTotals(list) {
  const map = new Map();
  list
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const cat = t.category || "Other";
      map.set(cat, (map.get(cat) || 0) + t.amount);
    });

  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { labels: ["No Data"], values: [1] };

  return {
    labels: entries.map((e) => e[0]),
    values: entries.map((e) => e[1]),
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getStatusClass(status) {
  if (status === "Completed") return "badge-completed";
  if (status === "Pending")   return "badge-pending";
  return "badge-expense";
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function setDefaultDate() {
  const dateInput = document.getElementById("transactionDate");
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
}

function loadTheme() {
  return localStorage.getItem(themeKey) || "light";
}

function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");
  const icon = themeToggle ? themeToggle.querySelector("i") : null;
  if (icon) icon.className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

function toggleTheme() {
  const next = document.body.classList.contains("dark-mode") ? "light" : "dark";
  localStorage.setItem(themeKey, next);
  applyTheme(next);
  renderChart();
}

function normalizeTransaction(t) {
  if (!t || typeof t !== "object") return null;
  const type   = t.type === "income" ? "income" : "expense";
  const amount = Number(t.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id:       Number(t.id) || Date.now(),
    title:    String(t.title   || "Untitled"),
    category: String(t.category || (type === "income" ? "Income" : "Expense")),
    type,
    amount,
    date:     isValidDate(t.date) ? t.date : new Date().toISOString().split("T")[0],
    status:   String(t.status   || (type === "income" ? "Completed" : "Expense")),
  };
}

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}
