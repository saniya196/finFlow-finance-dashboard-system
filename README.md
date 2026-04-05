# FinFlow Finance Dashboard

A modern, premium finance dashboard built with only four files:

- `index.html`
- `style.css`
- `script.js`
- `README.md`

## What It Includes

- Login and signup UI in the same page (frontend-only authentication)
- Multi-user account simulation using localStorage
- Personalized per-user transactions (each user sees only their own data)
- Wide premium sidebar with gradient, active states, hover animation, and profile card
- Top navbar with search, notifications, dark mode toggle, and gradient CTA
- Financial Overview header with modern typography (Manrope)
- 4 summary cards: Balance, Income, Expenses, Savings
- Doughnut chart (Chart.js) with filter toggles and custom legend
- Quick stats panel with clean rows and subtle dividers
- Recent transactions table with filter pills, status badges, edit and delete actions
- Add/Edit transaction modal
- Dark mode preference saved per user
- Mobile responsive layout with collapsible sidebar

## Run

1. Open `index.html` in your browser.
2. Login with demo user or create a new account.

Demo credentials:

- Email: `demo@finflow.com`
- Password: `Demo@123`

## Data Storage Keys

- Users: `ff_users`
- Active session: `ff_current_user`
- User theme: `ff_theme_<email>`
- User transactions: `ff_transactions_<email>`

## Notes

- This project has no backend and is meant for UI/demo purposes.
- All data is stored in browser localStorage.