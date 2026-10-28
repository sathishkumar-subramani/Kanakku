# Kanakku — web app

React 19 + Vite + TypeScript, Redux Toolkit / RTK Query, React Router 7, Tailwind 3, Recharts. Talks to the Kanakku API (see `../docs/API.md`).

```bash
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:5080/api  (or your Render URL)
npm run dev                 # http://localhost:5173
npm run build               # production build → dist/
npm test                    # 21 tests: Vitest + Testing Library against an in-memory API (tests/fakeApi.ts)
npm run typecheck
```

## Deploy on Vercel

Import the repo, set **Root Directory** to `web`, add the env var `VITE_API_URL=https://<your-api>.onrender.com/api`, deploy. `vercel.json` already rewrites every path to `index.html` for client-side routing.

## Layout

```
src/
├── api/          session.ts (token storage + single-flight refresh), baseQuery.ts (RTK re-auth), kanakkuApi.ts (endpoints), types.ts
├── store/        Redux store + auth slice (mirror of the stored session)
├── theme/        tokens (copied from ../shared/theme.json), ThemeProvider (system / light / dark)
├── utils/        money (₹ Indian grouping), dates (YYYY-MM-DD helpers), split (live split maths), download (PDF/CSV)
├── components/   ui/ (Button, Field, Modal, Toast, bits), layout/AppShell, expenses/, groups/, charts/
└── pages/        Auth, Dashboard, Groups, Group (Expenses · Balances · Activity · Members), Personal, Reports, Settings, Join
```
