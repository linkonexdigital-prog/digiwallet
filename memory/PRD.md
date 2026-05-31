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
