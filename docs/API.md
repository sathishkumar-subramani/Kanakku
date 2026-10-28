# Kanakku API contract

Base URL: `https://<your-render-service>.onrender.com/api` (local: `http://localhost:5080/api`).
All requests and responses are JSON (camelCase). Money is a decimal number (e.g. `1250.50`), never a string. Ids are MongoDB ObjectId strings.

**Dates:** the `date` of an expense / settlement / personal expense is a *calendar day* with no time: always a `"YYYY-MM-DD"` string (e.g. `"2026-10-28"`), in requests and responses alike. Clients must format the day the user picked (`format(d, 'yyyy-MM-dd')`), never `toISOString()` of a local midnight (that shifts to the previous UTC day in IST). `month` query params are `"YYYY-MM"`. Audit fields (`createdAt`, `updatedAt`, `joinedAt`, `accessTokenExpiresAt`) are full ISO-8601 UTC timestamps.

Every endpoint except `/auth/register`, `/auth/login`, `/auth/refresh` and `/health` needs
`Authorization: Bearer <accessToken>`.

Errors use RFC 7807 problem details:

```json
{ "status": 400, "title": "Validation failed", "detail": "Amount must be greater than 0", "errors": { "amount": ["Amount must be greater than 0"] } }
```

`401` = token missing/expired (clients call `/auth/refresh` once, then retry). `403` = not a member / not allowed. `404` = not found. `409` = conflict (duplicate email, unsettled balance on leave).

## Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, password }` (password ≥ 6) | `AuthResponse` |
| POST | `/auth/login` | `{ email, password }` | `AuthResponse` |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken, accessTokenExpiresAt }` (old refresh token is revoked) |
| POST | `/auth/logout` | `{ refreshToken }` | 204 |
| GET | `/auth/me` | – | `User` |
| PUT | `/auth/me` | `{ name?, currency?, avatarColor? }` | `User` |
| PUT | `/auth/password` | `{ currentPassword, newPassword, refreshToken? }` | 204. Every refresh token except the one sent as `refreshToken` is revoked, so other devices are signed out and this one stays in |

```ts
User = { id, name, email, currency /* "INR" */, avatarColor /* hex */, createdAt }
AuthResponse = { user: User, accessToken, refreshToken, accessTokenExpiresAt }
```

Access tokens live 60 minutes, refresh tokens 60 days (rotating). Web keeps both in `localStorage`; mobile keeps them in SecureStore.

## Users

| GET | `/users/lookup?email=` | find a registered user to add to a group → `{ id, name, email, avatarColor }` or 404 |

## Groups

```ts
GroupMember = { userId, name, email, avatarColor, role /* "owner" | "member" */, joinedAt }
Group = {
  id, name, emoji, color, currency, inviteCode, simplifyDebts, createdBy, createdAt,
  members: GroupMember[],
  myBalance,            // + = others owe me, − = I owe (in this group)
  totalSpent,           // all-time group total
  monthSpent,           // current calendar month group total
  lastActivityAt
}
```

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/groups?month=YYYY-MM` | – | my groups, `Group[]` (`month` only affects `monthSpent`; defaults to the current month) |
| POST | `/groups` | `{ name, emoji?, color?, currency? }` | creator becomes owner |
| GET | `/groups/{id}` | – | `Group` |
| PUT | `/groups/{id}` | `{ name?, emoji?, color?, simplifyDebts? }` | owner only |
| DELETE | `/groups/{id}` | – | owner only, deletes expenses & settlements too |
| POST | `/groups/join` | `{ inviteCode }` | join by code → `Group` |
| POST | `/groups/{id}/invite/regenerate` | – | owner only → `{ inviteCode }` |
| POST | `/groups/{id}/members` | `{ email }` | add an existing user (any member can) |
| DELETE | `/groups/{id}/members/{userId}` | – | owner removes someone, or `userId` = me to leave. 409 if that person's balance ≠ 0 |
| GET | `/groups/{id}/balances` | – | `Balances` |
| GET | `/groups/{id}/activity?limit=50` | – | `Activity[]` newest first |

```ts
Balances = {
  simplified: boolean,
  members: [{ userId, name, avatarColor, balance, paid, share }],   // balance = paid − share ± settlements
  debts:   [{ fromUserId, fromName, toUserId, toName, amount }]      // who should pay whom
}
Activity = { id, groupId, actorId, actorName, type, message, refId, createdAt }
  // type: group.created | expense.added | expense.updated | expense.deleted | settlement.added | settlement.deleted | member.joined | member.left | group.updated
```

### Balance rules
* Each expense: the payer is credited `amount`; each split member is debited their `splits[].amount`.
* Each settlement: `from` is credited `amount`, `to` is debited `amount` (paying off a debt).
* `balance = paid − share + settlementsPaid − settlementsReceived`.
* If `simplifyDebts` is true the API returns the minimum number of transfers (greedy largest-debtor → largest-creditor). If false it returns the actual pairwise debts (A owes B exactly what A's splits on B-paid expenses add up to, net of the reverse and of settlements between them).
* All money is rounded to 2 dp; split rounding remainders (±0.01) go to the payer's own split, so splits always sum to the amount.

## Expenses

```ts
Category = "food" | "groceries" | "rent" | "utilities" | "travel" | "entertainment" | "shopping" | "health" | "household" | "other"
SplitType = "equal" | "exact" | "percent" | "shares"

Split = { userId, name, avatarColor, amount, value }
  // value = what the client sent: ignored for equal, rupees for exact, % for percent, share count for shares

Expense = {
  id, groupId, groupName, groupEmoji, description, amount, currency, category, date, notes,
  paidBy: { id, name, avatarColor },
  splitType, splits: Split[],
  myShare,                // my split amount (0 if not included)
  createdBy, createdAt, updatedAt
}
```

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/groups/{id}/expenses?month=YYYY-MM&category=&search=&page=1&pageSize=50` | – | `{ items: Expense[], total, page, pageSize }` newest first; omit `month` for all |
| POST | `/groups/{id}/expenses` | `ExpenseInput` | any member |
| GET | `/expenses/{id}` | – | |
| PUT | `/expenses/{id}` | `ExpenseInput` | any member of the group |
| DELETE | `/expenses/{id}` | – | any member of the group |
| GET | `/expenses/recent?limit=20` | – | my most recent expenses across all groups (where I paid or have a share) |

```ts
ExpenseInput = {
  description, amount, category, date, notes?,
  paidBy: userId,
  splitType,
  splits: [{ userId, value }]   // members included in the split. equal: value ignored; exact: rupees (must sum to amount); percent: must sum to 100; shares: positive integers
}
```

## Settlements

```ts
Settlement = { id, groupId, from: { id, name, avatarColor }, to: { id, name, avatarColor }, amount, date, note, createdBy, createdAt }
```

| GET | `/groups/{id}/settlements` | – | newest first |
| POST | `/groups/{id}/settlements` | `{ fromUserId, toUserId, amount, date?, note? }` | records "from paid to" |
| DELETE | `/settlements/{id}` | – | any member |

## Personal expenses (not shared with anyone)

```ts
PersonalExpense = { id, description, amount, category, date, notes, createdAt, updatedAt }
```

| GET | `/personal?month=YYYY-MM` | – | `PersonalExpense[]` newest first (month optional) |
| POST | `/personal` | `{ description, amount, category, date, notes? }` | |
| PUT | `/personal/{id}` | same | |
| DELETE | `/personal/{id}` | – | |

## Dashboard

`GET /dashboard?month=YYYY-MM` (defaults to current month, user's local month as sent by the client)

```ts
Dashboard = {
  month,                       // "2026-10"
  totalSpent,                  // groupShare + personalSpent  ← "what this month cost me"
  groupShare,                  // sum of my splits in group expenses this month
  personalSpent,               // sum of personal expenses this month
  iPaid,                       // sum of group expenses I paid this month (cash out of my pocket)
  prevMonthTotal,              // totalSpent of the previous month, for the trend chip
  youOwe, youAreOwed, netBalance,          // across all groups, all time (not month-bound)
  byGroup:    [{ groupId, name, emoji, color, amount, count }],  // my share per group; personal appears as groupId "personal"
  byCategory: [{ category, amount, count }],
  daily:      [{ date /* YYYY-MM-DD */, amount }],               // my spend per day, every day of the month
  groupBalances: [{ groupId, name, emoji, color, balance }],
  recent: Expense[]            // 10 latest (group + personal flattened; personal has groupId "personal")
}
```

## Reports

| GET | `/reports/months` | months that have any of my data plus the current month, newest first: `["2026-10", "2026-09"]` |
| GET | `/reports/monthly?month=YYYY-MM&groupId=&format=pdf` | PDF (`application/pdf`, `Content-Disposition: attachment; filename="kanakku-2026-10.pdf"`; scoped: `kanakku-2026-10-personal.pdf` / `kanakku-2026-10-<group-slug>.pdf`) |
| GET | `/reports/monthly?month=YYYY-MM&groupId=&format=csv` | CSV of every expense line for the month |

`groupId` optional: omit for everything (all groups + personal), `personal` for personal only, or a group id.

The PDF contains: summary (total, my share, I paid, personal), spend by group, spend by category, every expense of the month (date, group, description, category, paid by, total, my share), settlements of the month, and the closing balances per group.

## Health

`GET /health` → `{ status: "ok", db: "connected", time }` with 200, or `{ status: "degraded", db: "disconnected" }` with 503 while MongoDB is unreachable (no auth). `POST /auth/login` and `/auth/register` are rate-limited per IP (30 / 15 min and 20 / hour) → `429` with the usual problem shape. A refresh token that is presented again after it was already rotated is treated as stolen: every session of that account is revoked. Render free tier sleeps after 15 min idle; the first request can take ~30–60 s. Clients use a 60 s timeout and show a "waking up the server…" note on first load.
