# Kanakku — your room's shared ledger

**Kanakku** (Tamil: *accounts*) tracks the expenses you share with your roommates *and* the ones that are just yours, then tells you who owes whom and what the month cost you — on your Android phone, on the web, synced through one account.

Built for a rental room of 4–5 people, but a group can be anything: a trip, a team lunch fund, a flat.

```
kanakku/
├── api/      Node.js + Express 5 + MongoDB (Mongoose)  (auth, groups, expenses, balances, dashboard, PDF/CSV reports) → Render
├── web/      React 19 + Vite + Redux Toolkit/RTK Query + Tailwind  (same features, dark/light)          → Vercel
├── mobile/   React Native (Expo SDK 58 + expo-router)  (same features, Android APK via EAS)             → your phone
├── shared/   theme tokens used by both apps
├── docs/     API contract, design system, deployment guide
├── render.yaml, docker-compose.yml
```

## What it does

**Groups** — create one, share its 8-character invite code (or the `/join/CODE` link), roommates join. Any member adds expenses; the owner can rename, change the icon, regenerate the code, remove people, delete the group.

**Expenses** — amount, description, category (🍛 food, 🛒 groceries, 🏠 rent, 💡 utilities, 🚌 travel, 🎬 entertainment, 🛍️ shopping, 💊 health, 🧹 household, 📦 other), date, who paid, and the split:
- **Equal** between the people you tick (default), or
- **Advanced**: exact amounts, percentages, or shares — with a live "₹50 left to allocate" indicator; saving is blocked until it adds up.
- Rounding remainders (±₹0.01) go to the payer, so splits always sum to the total.

**Balances** — per group: each member's paid / share / net, and a **who-pays-whom** list. *Simplify debts* (on by default) collapses A→B→C into A→C; turn it off to see exact pairs. Tap **Settle** on a row to record a payment with the amount prefilled. A member can only leave when their balance is zero (the API answers 409 otherwise).

**Personal expenses** — your own spending (coffee, autos, recharges). Nobody else sees it, but it rolls into your dashboard and reports.

**Dashboard** — pick a month: *This month* (your share of group expenses + personal), *You owe*, *You are owed*, *I paid*, a trend chip vs last month, spend by group, by category (donut), per day, recent list, per-group balance lines.

**Reports** — month-end **PDF** (summary, by group, by category, every expense with your share, payments, current balances) and **CSV** for your own analysis — for everything, personal only, or one group. The PDF is generated server-side with pdfkit and bundles Noto Sans so ₹ renders.

**Activity** — a feed per group: who added/edited/deleted what, who paid whom, who joined/left.

**Settings** — name, avatar colour, currency (INR default), theme (system / light / dark), change password, sign out. That's all — configuration stays minimal on purpose.

**Auth** — email + password, 60-minute access tokens with rotating 60-day refresh tokens (SecureStore on the phone, localStorage on the web). Changing your password signs out other devices.

## Quick start

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for the full MongoDB Atlas → Render → Vercel → EAS walkthrough, and local development.

```bash
# API            (needs Node 20+ and MongoDB; or `docker compose up --build` from the repo root)
cd api && npm install && cp .env.example .env && npm run dev     # http://localhost:5080
cd api && npm run seed                                            # optional demo room (sathish@demo.kanakku / demo1234)

# Web
cd web && npm install && cp .env.example .env && npm run dev     # http://localhost:5173

# Mobile (Expo Go on your phone, no Android Studio)
cd mobile && npm install && npx expo start
```

Environment variables the API understands: `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET` (≥ 32 chars), `CLIENT_ORIGINS` (comma-separated, empty = any), `PORT` (set by Render).

## Docs

- [docs/API.md](docs/API.md) — every endpoint, DTO shapes, split and balance rules. Both apps are written against this.
- [docs/DESIGN.md](docs/DESIGN.md) — colours, type, copy rules, screen list.
- [docs/DEPLOY.md](docs/DEPLOY.md) — deployment and local setup.
- [mobile/README.md](mobile/README.md) — running in Expo Go and building the APK.

## Verification done before handover

- `web`: TypeScript strict + production build clean; **21 automated tests** (Vitest + Testing Library against an in-memory implementation of the API contract) cover sign-in/sign-up, the token-refresh flow, dashboard numbers, group expenses with an exact split, settle-up, members/invite, personal expenses, reports download, settings.
- `mobile`: TypeScript clean and the Expo bundle exports successfully (see mobile/README.md).
- `api`: **36 end-to-end tests** (Vitest + Supertest) run the real Express app and real Mongoose against an in-memory MongoDB wire-protocol server (`api/tests/fakeMongo.js`) — sign-up/sign-in/refresh rotation, groups and invite codes, exact/percent/shares splits, balances (simplified and pairwise), settle-up, member removal rules, personal expenses, dashboard numbers, PDF/CSV reports, the demo seed. An independent code review was done on top of that.

## Tech

| | |
|---|---|
| API | Node 22, Express 5, Mongoose 9, jsonwebtoken, bcryptjs, zod 4, pdfkit, helmet, pino |
| Web | React 19, Vite, TypeScript, Redux Toolkit + RTK Query, React Router 7, Tailwind 3, Recharts, lucide-react, date-fns |
| Mobile | Expo SDK 58, expo-router, TanStack Query, axios, zustand, react-native-gifted-charts, expo-secure-store |
| Fonts | Plus Jakarta Sans (UI) · DM Mono (amounts) · Noto Sans (PDF) |
