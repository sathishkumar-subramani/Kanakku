# Kanakku API

Node 20+ · Express 5 · Mongoose 9 (MongoDB) · JWT · zod · pdfkit. Implements [`../docs/API.md`](../docs/API.md) exactly — the web and mobile apps are written against that contract.

```bash
npm install
cp .env.example .env         # MONGODB_URI (Atlas or local), JWT_SECRET
npm run dev                  # http://localhost:5080  (restarts on change)
npm run seed                 # demo room: sathish@demo.kanakku / demo1234 (+ arun, priya, karthik)
npm test                     # 36 tests: real Express + Mongoose against an in-memory MongoDB (tests/fakeMongo.js)
```

No build step — plain ES modules, so Render just runs `npm start`.

## Environment

| Variable | Default | Notes |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | Atlas: `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` |
| `MONGODB_DB` | `kanakku` | database name (collections + indexes are created on first start) |
| `JWT_SECRET` | dev-only value | **required in production**, ≥ 32 chars; the app refuses to start with the dev value when `NODE_ENV=production` |
| `CLIENT_ORIGINS` | *(empty = any origin)* | comma-separated; `https://*.vercel.app` wildcards allowed |
| `PORT` | `5080` | Render sets this |
| `ACCESS_TOKEN_MINUTES` / `REFRESH_TOKEN_DAYS` | `60` / `60` | token lifetimes |
| `LOG_LEVEL` | `info` | pino level |

## Layout

```
src/
├── index.js        start: listen first (so Render's health check passes), then connect MongoDB
├── app.js          express app: helmet, cors, logging, routes, problem-details error handler
├── config.js       env parsing + guards
├── db.js           mongoose connect + syncIndexes
├── lib/            errors (ApiError + RFC 7807 handler), util (days/months/money/ids), validate (zod schemas), logger
├── middleware/     requireAuth (Bearer JWT → req.userId)
├── models/         User, RefreshToken, Group, Expense, Settlement, PersonalExpense, Activity
├── services/       calculators (splits · balances · simplify · pairwise), data (loaders + membership checks),
│                   auth, mappers (DTOs), reports (dashboard + monthly report model + CSV), pdf (pdfkit)
└── routes/         auth+users, groups (members · balances · activity), expenses, settlements+personal, dashboard+reports
scripts/seed.js     demo data
tests/              calculators.test.js · api.test.js (end-to-end) · seed.test.js · fakeMongo.js
fonts/              Noto Sans (bundled so ₹ renders in PDFs)
```

## Design notes

- **Money** is stored as a JS number rounded to 2 dp at every write; balances are compared with a ±0.005 tolerance. Split rounding remainders go to the payer so splits always sum to the total (see `services/calculators.js`).
- **Dates**: an expense's `date` is a calendar day stored as UTC midnight and exchanged as `"YYYY-MM-DD"`; audit timestamps are full ISO strings.
- **Auth**: HS256 access tokens (60 min) + opaque refresh tokens stored hashed in their own collection, rotated on every refresh, revoked on logout / password change (the device that changes the password keeps its own token). Replaying an already-rotated refresh token signs the whole account out. Login/register are rate-limited.
- **Errors** are always `{ status, title, detail, errors }` with `application/problem+json`, including zod validation (`errors` = `{ field: [messages] }`).
- **Reports**: PDF built with pdfkit (summary tiles, by group, by category, every expense with your share, payments, current balances), CSV with a BOM so Excel opens it with the ₹ intact.

## Deploy

See [`../docs/DEPLOY.md`](../docs/DEPLOY.md). The repo-root `render.yaml` deploys this folder as a Render **Node** web service (`npm ci` → `npm start`, health check `/health`). A `Dockerfile` is included if you prefer containers (`docker compose up --build` at the repo root runs API + MongoDB locally).
