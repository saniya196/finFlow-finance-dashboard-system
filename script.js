const storageKey = "fintrack-transactions";
const themeKey = "fintrack-theme";

const defaultTransactions = [
	{ id: 1, title: "Salary", category: "Income", type: "income", amount: 60000, date: "2026-04-01", status: "Completed" },
	{ id: 2, title: "Swiggy", category: "Food", type: "expense", amount: 450, date: "2026-04-01", status: "Expense" },
	{ id: 3, title: "Electricity Bill", category: "Bills", type: "expense", amount: 2300, date: "2026-03-31", status: "Pending" },
	{ id: 4, title: "Freelance Payment", category: "Income", type: "income", amount: 18000, date: "2026-03-30", status: "Completed" },
	{ id: 5, title: "Netflix", category: "Entertainment", type: "expense", amount: 649, date: "2026-03-29", status: "Expense" },
];

let transactions = loadTransactions();
let currentFilter = "all";
let searchTerm = "";
let expenseChart = null;

const tableBody = document.getElementById("transactionsTableBody");
const searchInput = document.getElementById("searchInput");
const transactionForm = document.getElementById("transactionForm");
const themeToggle = document.getElementById("themeToggle");

initializeApp();

function initializeApp() {
	applyTheme(loadTheme());
	setDefaultDate();
	bindEvents();
	renderDashboard();
}

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

function loadTransactions() {
	const savedTransactions = localStorage.getItem(storageKey);

	if (!savedTransactions) {
		localStorage.setItem(storageKey, JSON.stringify(defaultTransactions));
		return [...defaultTransactions];
	}

	try {
		const parsedTransactions = JSON.parse(savedTransactions);

		if (!Array.isArray(parsedTransactions)) {
			return [...defaultTransactions];
		}

		const safeTransactions = parsedTransactions
			.map(normalizeTransaction)
			.filter(Boolean);

		if (!safeTransactions.length) {
			localStorage.setItem(storageKey, JSON.stringify(defaultTransactions));
			return [...defaultTransactions];
		}

		return safeTransactions;
	} catch {
		localStorage.setItem(storageKey, JSON.stringify(defaultTransactions));
		return [...defaultTransactions];
	}
}

function saveTransactions() {
	localStorage.setItem(storageKey, JSON.stringify(transactions));
}

function renderDashboard() {
	renderSummaryCards();
	renderChart();
	renderQuickStats();
	renderTransactions();
}

function renderSummaryCards() {
	const totals = calculateTotals(transactions);

	document.querySelector('[data-summary="balance"]').textContent = formatCurrency(totals.income - totals.expenses);
	document.querySelector('[data-summary="income"]').textContent = formatCurrency(totals.income);
	document.querySelector('[data-summary="expenses"]').textContent = formatCurrency(totals.expenses);
	document.querySelector('[data-summary="savings"]').textContent = formatCurrency(Math.max(totals.income - totals.expenses, 0));

	document.querySelector('[data-summary-note="balance"]').textContent = `${totals.income >= totals.expenses ? "Healthy" : "Needs attention"} cash position`;
	document.querySelector('[data-summary-note="income"]').textContent = `${transactions.filter((transaction) => transaction.type === "income").length} income entries`;
	document.querySelector('[data-summary-note="expenses"]').textContent = `${transactions.filter((transaction) => transaction.type === "expense").length} expense entries`;
	document.querySelector('[data-summary-note="savings"]').textContent = `${totals.income ? Math.round(((totals.income - totals.expenses) / totals.income) * 100) : 0}% of income retained`;
}

function renderTransactions() {
	const filteredTransactions = transactions.filter((transaction) => {
		const matchesFilter = currentFilter === "all" || transaction.type === currentFilter;
		const matchesSearch = transaction.title.toLowerCase().includes(searchTerm);
		return matchesFilter && matchesSearch;
	});

	if (!filteredTransactions.length) {
		tableBody.innerHTML = `
			<tr>
				<td colspan="6" class="text-center py-5 empty-state">No transactions match your filters.</td>
			</tr>
		`;
		return;
	}

	tableBody.innerHTML = filteredTransactions
		.map((transaction) => {
			const amountClass = transaction.type === "income" ? "amount-positive" : "amount-negative";
			const signedAmount = transaction.type === "income" ? `+${formatCurrency(transaction.amount)}` : `-${formatCurrency(transaction.amount)}`;
			const statusClass = getStatusClass(transaction.status);

			return `
				<tr>
					<td>
						<div class="fw-semibold">${escapeHtml(transaction.title)}</div>
						<small class="text-muted">${transaction.type === "income" ? "Money in" : "Money out"}</small>
					</td>
					<td>${escapeHtml(transaction.category)}</td>
					<td>${formatDate(transaction.date)}</td>
					<td class="${amountClass}">${signedAmount}</td>
					<td><span class="badge badge-status ${statusClass}">${transaction.status}</span></td>
					<td class="text-end">
						<div class="transaction-actions">
							<button class="btn btn-sm btn-outline-danger" type="button" data-delete-id="${transaction.id}">Delete</button>
						</div>
					</td>
				</tr>
			`;
		})
		.join("");

	document.querySelectorAll("[data-delete-id]").forEach((button) => {
		button.addEventListener("click", () => deleteTransaction(Number(button.dataset.deleteId)));
	});
}

function renderChart() {
	const context = document.getElementById("expenseChart");
	const categoryExpenseTotals = getCategoryExpenseTotals(transactions);

	if (expenseChart) {
		expenseChart.destroy();
	}

	const isDarkMode = document.body.classList.contains("dark-mode");
	const borderColor = isDarkMode ? "#0f1b2d" : "#f4f6fb";
	const palette = ["#f4b13b", "#46b8b0", "#4b8df0", "#a56be5", "#f09a52", "#f05d61", "#df5fa4"];

	expenseChart = new Chart(context, {
		type: "doughnut",
		data: {
			labels: categoryExpenseTotals.labels,
			datasets: [
				{
					label: "Expenses",
					data: categoryExpenseTotals.values,
					backgroundColor: palette,
					borderColor,
					borderWidth: 2,
					hoverOffset: 6,
					cutout: "64%",
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			layout: {
				padding: {
					top: 6,
					bottom: 4,
					left: 0,
					right: 0,
				},
			},
			plugins: {
				legend: {
					display: true,
					position: "top",
					align: "end",
					labels: {
						usePointStyle: true,
						pointStyle: "circle",
						boxWidth: 8,
						boxHeight: 8,
						padding: 14,
						color: isDarkMode ? "#b7c5da" : "#7b8797",
						font: {
							size: 12,
							weight: "600",
							family: "'Segoe UI', sans-serif",
						},
					},
				},
				tooltip: {
					mode: "point",
					intersect: true,
					backgroundColor: isDarkMode ? "rgba(20, 35, 55, 0.96)" : "rgba(15, 23, 42, 0.88)",
					titleColor: isDarkMode ? "#e8f0ff" : "#122033",
					bodyColor: isDarkMode ? "#a5d8ff" : "#2563eb",
					borderColor: isDarkMode ? "rgba(96, 165, 250, 0.3)" : "rgba(37, 99, 235, 0.2)",
					borderWidth: 1,
					padding: 12,
					displayColors: true,
					titleFont: {
						size: 13,
						weight: "700",
						family: "'Segoe UI', sans-serif",
					},
					bodyFont: {
						size: 14,
						weight: "600",
						family: "'Segoe UI', sans-serif",
					},
					callbacks: {
						label: (tooltipItem) => `${tooltipItem.label}: ${formatCurrency(tooltipItem.raw)}`,
					},
					cornerRadius: 10,
				},
			},
		},
	});
}

function renderQuickStats() {
	const monthTotal = transactions
		.filter((transaction) => {
			const date = new Date(transaction.date);
			const now = new Date();
			return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
		})
		.reduce((sum, transaction) => sum + transaction.amount, 0);

	const avgTransaction = transactions.length
		? Math.round(transactions.reduce((sum, transaction) => sum + transaction.amount, 0) / transactions.length)
		: 0;

	const categoryCount = new Set(transactions.map((transaction) => transaction.category)).size;
	const completedCount = transactions.filter((transaction) => transaction.status === "Completed").length;
	const pendingCount = transactions.filter((transaction) => transaction.status === "Pending").length;

	const monthElement = document.querySelector('[data-quick="month"]');
	const avgElement = document.querySelector('[data-quick="avg"]');
	const categoryElement = document.querySelector('[data-quick="categories"]');
	const completedElement = document.querySelector('[data-quick="completed"]');
	const pendingElement = document.querySelector('[data-quick="pending"]');

	if (monthElement) {
		monthElement.textContent = formatCurrency(monthTotal);
	}

	if (avgElement) {
		avgElement.textContent = formatCurrency(avgTransaction);
	}

	if (categoryElement) {
		categoryElement.textContent = String(categoryCount);
	}

	if (completedElement) {
		completedElement.textContent = String(completedCount);
	}

	if (pendingElement) {
		pendingElement.textContent = String(pendingCount);
	}
}

function handleFormSubmit(event) {
	event.preventDefault();

	const titleInput = document.getElementById("transactionTitle");
	const amountInput = document.getElementById("transactionAmount");
	const categoryInput = document.getElementById("transactionCategory");
	const typeInput = document.getElementById("transactionType");
	const dateInput = document.getElementById("transactionDate");

	const title = titleInput.value.trim();
	const amount = Number(amountInput.value);
	const category = categoryInput.value.trim();
	const type = typeInput.value;
	const date = dateInput.value;
	const isValid = validateFormInputs(titleInput, amountInput, title, amount);

	if (!isValid) {
		return;
	}

	const newTransaction = {
		id: Date.now(),
		title,
		category: category || (type === "income" ? "Income" : "Expense"),
		type,
		amount,
		date: date || new Date().toISOString().split("T")[0],
		status: type === "income" ? "Completed" : "Expense",
	};

	transactions = [newTransaction, ...transactions];
	saveTransactions();
	renderDashboard();
	transactionForm.reset();
	setDefaultDate();

	const modalElement = document.getElementById("transactionModal");
	const modalInstance = bootstrap.Modal.getInstance(modalElement);

	if (modalInstance) {
		modalInstance.hide();
	}
}

function validateFormInputs(titleInput, amountInput, title, amount) {
	// Keep validation simple and explicit for easier learning.
	titleInput.classList.remove("is-invalid");
	amountInput.classList.remove("is-invalid");

	let isValid = true;

	if (!title) {
		titleInput.classList.add("is-invalid");
		isValid = false;
	}

	if (!Number.isFinite(amount) || amount <= 0) {
		amountInput.classList.add("is-invalid");
		isValid = false;
	}

	return isValid;
}

function deleteTransaction(transactionId) {
	transactions = transactions.filter((transaction) => transaction.id !== transactionId);
	saveTransactions();
	renderDashboard();
}

function calculateTotals(sourceTransactions) {
	return sourceTransactions.reduce(
		(totals, transaction) => {
			if (transaction.type === "income") {
				totals.income += transaction.amount;
			} else {
				totals.expenses += transaction.amount;
			}

			return totals;
		},
		{ income: 0, expenses: 0 }
	);
}

function getCategoryExpenseTotals(sourceTransactions) {
	const expenseMap = new Map();

	sourceTransactions
		.filter((transaction) => transaction.type === "expense")
		.forEach((transaction) => {
			const category = transaction.category || "Other";
			expenseMap.set(category, (expenseMap.get(category) || 0) + transaction.amount);
		});

	const entries = Array.from(expenseMap.entries()).sort((a, b) => b[1] - a[1]);

	if (!entries.length) {
		return {
			labels: ["No Data"],
			values: [1],
		};
	}

	return {
		labels: entries.map((entry) => entry[0]),
		values: entries.map((entry) => entry[1]),
	};
}

function formatCurrency(value) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(value);
}

function formatCompactCurrency(value) {
	return new Intl.NumberFormat("en-IN", {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
}

function formatDate(dateString) {
	return new Date(dateString).toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

function getStatusClass(status) {
	if (status === "Completed") {
		return "badge-completed";
	}

	if (status === "Pending") {
		return "badge-pending";
	}

	return "badge-expense";
}

function escapeHtml(value) {
	const div = document.createElement("div");
	div.textContent = value;
	return div.innerHTML;
}

function setDefaultDate() {
	const dateInput = document.getElementById("transactionDate");
	dateInput.value = new Date().toISOString().split("T")[0];
}

function loadTheme() {
	return localStorage.getItem(themeKey) || "light";
}

function applyTheme(theme) {
	document.body.classList.toggle("dark-mode", theme === "dark");
	themeToggle.querySelector("i").className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

function toggleTheme() {
	const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
	localStorage.setItem(themeKey, nextTheme);
	applyTheme(nextTheme);
	renderChart();
}

function getAxisColor() {
	return getComputedStyle(document.body).getPropertyValue("--text-secondary").trim();
}

function normalizeTransaction(transaction) {
	if (!transaction || typeof transaction !== "object") {
		return null;
	}

	const normalizedType = transaction.type === "income" ? "income" : "expense";
	const normalizedAmount = Number(transaction.amount);

	if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
		return null;
	}

	return {
		id: Number(transaction.id) || Date.now(),
		title: String(transaction.title || "Untitled"),
		category: String(transaction.category || (normalizedType === "income" ? "Income" : "Expense")),
		type: normalizedType,
		amount: normalizedAmount,
		date: isValidDate(transaction.date) ? transaction.date : new Date().toISOString().split("T")[0],
		status: String(transaction.status || (normalizedType === "income" ? "Completed" : "Expense")),
	};
}

function isValidDate(value) {
	return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}
