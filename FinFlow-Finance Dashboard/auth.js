// ─── Storage Keys ────────────────────────────────────────────────────────────
const AUTH_STORAGE_KEYS = {
  users: "ff_users",
  currentUser: "ff_current_user"
};

// ─── User Helpers ─────────────────────────────────────────────────────────────

function getUsers() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.users) || "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(AUTH_STORAGE_KEYS.users, JSON.stringify(users));
}

function setCurrentUser(email) {
  localStorage.setItem(AUTH_STORAGE_KEYS.currentUser, email);
}

function getCurrentUserEmail() {
  return localStorage.getItem(AUTH_STORAGE_KEYS.currentUser);
}

function getCurrentUser() {
  const email = getCurrentUserEmail();
  if (!email) return null;
  return getUsers().find((user) => user.email === email) || null;
}

function clearCurrentUser() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.currentUser);
}

// Each user's transactions live under their own unique key
function getUserTransactionsKey(email) {
  return `ff_transactions_${String(email).toLowerCase()}`;
}

// ─── Demo User Seed ───────────────────────────────────────────────────────────

function seedDemoUser() {
  const demoEmail = "demo@finflow.com";
  const users = getUsers();

  if (!users.some((u) => u.email === demoEmail)) {
    users.push({ id: Date.now(), name: "Demo User", email: demoEmail, password: "Demo@123" });
    saveUsers(users);
  }

  const txKey = getUserTransactionsKey(demoEmail);
  if (!localStorage.getItem(txKey)) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    localStorage.setItem(txKey, JSON.stringify([
      { id: 1, title: "Salary",           category: "Income",        type: "income",  amount: 60000, date: `${y}-${m}-01`, status: "Completed" },
      { id: 2, title: "Rent",             category: "Housing",       type: "expense", amount: 22000, date: `${y}-${m}-02`, status: "Completed" },
      { id: 3, title: "Groceries",        category: "Food",          type: "expense", amount: 3500,  date: `${y}-${m}-04`, status: "Pending"   },
      { id: 4, title: "Freelance Payment",category: "Income",        type: "income",  amount: 18000, date: `${y}-${m}-05`, status: "Completed" },
      { id: 5, title: "Netflix",          category: "Entertainment", type: "expense", amount: 649,   date: `${y}-${m}-06`, status: "Completed" }
    ]));
  }
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Min 6 chars AND at least one number
function isStrongPassword(password) {
  return password.length >= 6 && /\d/.test(password);
}

function showFieldError(inputEl, message) {
  if (!inputEl) return;
  inputEl.classList.add("field-invalid");
  let errSpan = inputEl.parentElement.querySelector(".inline-field-error");
  if (!errSpan) {
    errSpan = document.createElement("span");
    errSpan.className = "inline-field-error";
    inputEl.insertAdjacentElement("afterend", errSpan);
  }
  errSpan.textContent = message;
}

function clearFieldError(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove("field-invalid");
  const errSpan = inputEl.parentElement.querySelector(".inline-field-error");
  if (errSpan) errSpan.remove();
}

function clearAllFieldErrors(formEl) {
  formEl.querySelectorAll(".field-invalid").forEach((el) => el.classList.remove("field-invalid"));
  formEl.querySelectorAll(".inline-field-error").forEach((el) => el.remove());
}

function setMessage(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.className = `auth-msg ${type}`;
}

// ─── Login Handler ────────────────────────────────────────────────────────────

function handleLoginSubmit(event) {
  event.preventDefault();

  const emailInput    = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const messageEl     = document.getElementById("loginMessage");

  clearAllFieldErrors(event.target);
  setMessage(messageEl, "", "");

  const email    = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  let hasError = false;

  if (!email) {
    showFieldError(emailInput, "Email is required.");
    hasError = true;
  } else if (!isValidEmail(email)) {
    showFieldError(emailInput, "Enter a valid email address.");
    hasError = true;
  }

  if (!password) {
    showFieldError(passwordInput, "Password is required.");
    hasError = true;
  }

  if (hasError) return;

  const user = getUsers().find((u) => u.email === email && u.password === password);

  if (!user) {
    setMessage(messageEl, "Invalid email or password.", "error");
    emailInput.classList.add("field-invalid");
    passwordInput.classList.add("field-invalid");
    return;
  }

  setCurrentUser(user.email);
  setMessage(messageEl, "Login successful. Redirecting...", "success");
  setTimeout(() => { window.location.href = "index.html"; }, 600);
}

// ─── Signup Handler ───────────────────────────────────────────────────────────

function handleSignupSubmit(event) {
  event.preventDefault();

  const nameInput     = document.getElementById("signupName");
  const emailInput    = document.getElementById("signupEmail");
  const passwordInput = document.getElementById("signupPassword");
  const confirmInput  = document.getElementById("signupConfirm");
  const messageEl     = document.getElementById("signupMessage");

  clearAllFieldErrors(event.target);
  setMessage(messageEl, "", "");

  const name     = nameInput.value.trim();
  const email    = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const confirm  = confirmInput ? confirmInput.value : password;

  let hasError = false;

  if (!name) {
    showFieldError(nameInput, "Name is required.");
    hasError = true;
  }

  if (!email) {
    showFieldError(emailInput, "Email is required.");
    hasError = true;
  } else if (!isValidEmail(email)) {
    showFieldError(emailInput, "Enter a valid email address.");
    hasError = true;
  }

  if (!password) {
    showFieldError(passwordInput, "Password is required.");
    hasError = true;
  } else if (!isStrongPassword(password)) {
    showFieldError(passwordInput, "Password must be 6+ characters and include at least one number.");
    hasError = true;
  }

  if (confirmInput && password && confirm !== password) {
    showFieldError(confirmInput, "Passwords do not match.");
    hasError = true;
  }

  if (hasError) return;

  const users = getUsers();
  if (users.some((u) => u.email === email)) {
    showFieldError(emailInput, "This email is already registered.");
    return;
  }

  users.push({ id: Date.now(), name, email, password });
  saveUsers(users);
  localStorage.setItem(getUserTransactionsKey(email), JSON.stringify([]));

  setCurrentUser(email);
  setMessage(messageEl, "Account created! Redirecting...", "success");
  setTimeout(() => { window.location.href = "index.html"; }, 700);
}

// ─── Page Init ────────────────────────────────────────────────────────────────

function initAuthPage() {
  seedDemoUser();

  const page        = document.body.dataset.page;
  const currentUser = getCurrentUser();

  if ((page === "login" || page === "signup") && currentUser) {
    window.location.href = "index.html";
    return;
  }

  if (page === "login") {
    const form = document.getElementById("loginForm");
    if (form) form.addEventListener("submit", handleLoginSubmit);
  }

  if (page === "signup") {
    const form = document.getElementById("signupForm");
    if (form) form.addEventListener("submit", handleSignupSubmit);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

window.AppAuth = {
  getUsers,
  getCurrentUser,
  setCurrentUser,
  clearCurrentUser,
  getUserTransactionsKey,
  seedDemoUser
};

document.addEventListener("DOMContentLoaded", initAuthPage);
