# DigiWallet V2 — Product Requirements

## Original Problem Statement
Rebuild a premium fintech-style digital wallet platform ("DigiWallet V2") with modern architecture, modern UI, better admin controls, and production-ready code. Users register with full_name + mobile + password (no OTP, no social login). External systems credit user wallets via a single signed API endpoint `POST /api/credit`. Users request withdrawals via UPI or Bank. Admin processes withdrawals (approve/reject/mark paid). Includes notifications, Telegram alerts module, and a powerful super-admin panel. STRICTLY NO referral/cashback/rewards/bonus/spin/scratch/gamification/MLM/affiliate.

## Tech Stack (adapted to available environment)
- Frontend: React 19 + Tailwind 3 + Shadcn-style primitives + Phosphor Icons + Framer Motion
- Backend: FastAPI + Motor (async MongoDB) + bcrypt + PyJWT + httpx (Telegram)
- Database: MongoDB
- Fonts: Outfit (display) · Plus Jakarta Sans (body) · JetBrains Mono (numbers)

## Architecture
- Single-file backend at `/app/backend/server.py` exposing routes under `/api/*` and `/api/admin/*`.
- React SPA at `/app/frontend/src/` with separate `AppLayout` (user) and `AdminLayout` (admin) shells.
- Auth: JWT Bearer tokens (1 day), bcrypt password hashes, brute-force lockout (5 attempts / 15 min by ip+mobile).
- Idempotency: `/api/credit` uses composite unique index `(external_txn_id, api_key_id)`.

## User Personas
1. **End User** — manages wallet balance, adds UPI/bank methods, requests withdrawals, views transactions and notifications.
2. **Super Admin** — manages users, performs wallet operations, approves withdrawals, manages API keys, broadcasts notifications, monitors security, configures system.
3. **External System** — third-party service that credits user wallets via signed `/api/credit` API.

## Core Requirements (static)
- Mobile + password auth only (no OTP/social)
- Single API endpoint to credit wallet
- UPI + Bank withdrawals with admin approval flow
- Realtime notification bell + Telegram alerts (configurable)
- Comprehensive admin panel (users, wallet, withdrawals, API keys, notifications, security, settings)
- Dark + light mode toggle
- Premium Swiss/monochrome fintech aesthetic — no purple gradients, no Inter font

## What's Been Implemented (2026-01)
- ✅ JWT auth with bcrypt + brute-force protection + admin seeding
- ✅ Mobile + password register/login/me/change-password
- ✅ User dashboard with available balance hero + KPIs (Total Credits / Withdrawals / Pending)
- ✅ Transactions page with search/type/status filters
- ✅ Payment methods (UPI + Bank) — add/list/delete
- ✅ Withdrawal flow with balance lock + admin processing
- ✅ Notification center (in-app, unread badge, mark-all-read)
- ✅ Settings (change password)
- ✅ External `/api/credit` endpoint with API key auth, IP whitelist, duplicate detection, telegram alert
- ✅ Admin dashboard with 8 KPIs + recent transactions/withdrawals
- ✅ Admin user management (list/search/filter, edit, suspend/ban, freeze, reset password, login-as, force-logout, login history)
- ✅ Admin wallet ops (manual credit/debit/adjust/reverse, freeze/unfreeze)
- ✅ Admin withdrawal management (approve/reject/mark paid, bulk actions, CSV export, refund on reject)
- ✅ Admin API key management (create/pause/delete, IP whitelist, copy key, API logs viewer)
- ✅ Admin notification broadcast (all users or selected)
- ✅ Admin security center (login logs, sessions, force logout all)
- ✅ Admin system settings (branding, SEO, Telegram alerts with test, SMTP, maintenance mode)
- ✅ Light + Dark theme toggle (persisted)
- ✅ Backend regression suite: 43/43 tests passing

## Prioritized Backlog
- P1: Web push notifications (VAPID keys + service worker)
- P1: Refresh token rotation endpoint
- P2: Per-mobile (IP-agnostic) brute-force lockout
- P2: Mask API key in api_logs storage
- P2: Real SMTP send-test from Settings
- P3: Recharts analytics (daily credits/withdrawals chart on admin dashboard)
- P3: Withdrawal limits & cooldown per user

## Test Credentials
See `/app/memory/test_credentials.md`.
- Admin: mobile `9999999999`, password `Admin@123`
- Test user (created during testing): mobile `8888888888`, password `Test@123`

---

## v2.1 Update (Jan 2026)

### Added
- **Web Push (real OS-level notifications)** via Service Worker (`/sw.js`) + VAPID keys auto-generated on first startup. Users get notifications on Chrome/phone even when DigiWallet tab is closed.
- **Per-user Telegram bot alerts** — each user can save their own Telegram chat ID in Settings and receive transaction alerts on their personal Telegram.
- **`digiwallet<12-digit>` reference IDs** — every transaction gets a unique `ref_id` like `digiwallet622412553573` (shown in Transactions page, hidden from dashboard recent list which shows timestamp instead).
- **3 admin-controlled color themes** — Monochrome / Emerald / Cobalt — applied site-wide for BOTH user and admin dashboards. Live preview as admin selects.
- **7-day trend chart** on admin dashboard (Recharts area chart with brand gradient).
- **Brand-color system** — all primary CTAs, sidebar active states, hero gradients, pulsing dots now use `--brand` CSS variable that switches with theme.

### API additions
- `GET /api/push/public-key` — VAPID public key for subscription
- `POST /api/push/subscribe` — store subscription (auth required)
- `POST /api/push/unsubscribe` — remove subscription
- `POST /api/push/test` — fire a test push to current user
- `POST /api/auth/telegram` — save user's Telegram chat ID
- `POST /api/auth/telegram/test` — send test message to user's chat
- `PATCH /api/admin/settings { color_theme: monochrome|emerald|cobalt }` — site-wide theme switch
- `GET /api/admin/dashboard` now includes `chart_7d` (array of 7 daily totals)

---

## v2.2 Update (Jan 2026)

### Added
- **Disabled in-app popup toasts** — notifications now ONLY use native browser/OS notification (Service Worker `showNotification`) for less intrusive experience.
- **Persistent push notifications** — `requireInteraction: true`, vibrate pattern, sound ping — won't auto-dismiss until user clicks.
- **Faster polling** (5s) + auto-request permission once on first visit so users don't miss alerts.
- **Welcome greeting on user dashboard** — time-aware ("Good morning/afternoon/evening/night, [FirstName]") with first name in brand-gradient. Date overline with Sparkle icon.
- **3 Quick-action cards** on user dashboard — Withdraw / View transactions / Alerts & security with hover animations.
- **New Admin → Transactions section** at `/admin/transactions`:
  - 4 summary stats (records, credit volume, withdrawal volume, adjustments)
  - 7 filters: search, type, status, date range, amount range
  - Click-to-open detail drawer with user info, external API metadata, linked withdrawal, processing admin
  - Edit description / admin note / flag as suspicious
  - One-click **Reverse** transaction (for credit/debit)
  - **Export CSV** with current filters applied

### API additions
- `GET /api/admin/transactions` with rich filters (q, type, status, user_id, min/max amount, from/to date)
- `GET /api/admin/transactions/{id}` — detail + user + api_log + related_withdrawal + admin
- `GET /api/admin/transactions/export` — CSV export
- `PATCH /api/admin/transactions/{id}` — update description, status, flagged, admin_note


---

## v2.3 Code-Quality Pass (Feb 2026)

### Applied fixes
- **Hooks deps** — wrapped every async `load`/`loadUsers`/`refreshPush`/`showNotification`/`playPing` in `useCallback`; updated all `useEffect` arrays. Files: `Dashboard.jsx`, `Transactions.jsx`, `Settings.jsx`, `useLiveNotifications.js`, `AdminUsers.jsx`, `AdminWithdrawals.jsx`, `AdminWallet.jsx`, `AdminApi.jsx` (+ `GatewayUrlPanel` selectedKey dep), `AdminSecurity.jsx`, `AdminTransactions.jsx`. Eliminates stale-closure risk in pollers and push handlers.
- **Empty catch blocks** — `Dashboard.jsx` & `useLiveNotifications.js#playPing` now log via `console.debug` in dev only.
- **Context perf** — `AuthContext` and `ThemeContext` value objects wrapped in `useMemo` to stop unnecessary downstream re-renders.
- **Nested ternaries** extracted to named helpers (`tintBgClass`, `tintIconClass`, `typeIconWrap`, `typeIcon`, `pillType`, `amountColor`, `renderPushBadge`) in `Dashboard.jsx`, `AdminTransactions.jsx`, `Settings.jsx`.
- **Hardcoded test creds** — `tests/backend_test.py` now reads `DW_TEST_ADMIN_MOBILE`/`DW_TEST_ADMIN_PASSWORD` env vars (defaults retained for CI compatibility).

### Deliberately NOT applied (with rationale)
- `is` vs `==` for constants — **all** flagged sites are `is None` (PEP 8 mandated idiom). The linter rule is misfiring; no change needed.
- `amt` undefined at `server.py:1048` — false positive: `amt` is bound on line 971 inside a try; the except branch returns. All control paths to line 1048 have `amt` defined.
- `localStorage` → httpOnly cookies — architectural rewrite (would require backend cookie middleware, CORS `credentials: include`, CSRF token plumbing, and changes to every protected API call). JWT-in-localStorage is industry-standard for SPAs and not blocking. Tracked as future task.
- Splitting `_handle_gateway_credit`, `admin_transactions`, `useLiveNotifications`, `Settings`, `AppLayout` into sub-units — pure refactors. Tracked in roadmap below.

### Verification
- `webpack compiled successfully` with **zero** warnings.
- `eslint` clean.
- `/api/auth/login` returns valid JWT (curl).
- `/login` page renders, route guard redirects `/app` → `/login` when token invalid.
- No JS console errors.

### Roadmap (still pending)
- P1: Split `server.py` (1554 lines) into routers `auth.py`, `transactions.py`, `admin.py`, `webhooks.py`.
- P1: Pagination for `/api/admin/transactions` and `/api/transactions` (currently bounded at 100/200 limit only).
- P1: Decompose `useLiveNotifications` into `useServiceWorker`, `useNotificationPoller`; split `Settings.jsx` into 3 sub-cards.
- P2: Stream-based CSV export for large datasets.
- P2: Consider httpOnly cookie auth migration if compliance requires.
