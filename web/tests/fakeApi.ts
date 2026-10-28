/**
 * A tiny in-memory implementation of docs/API.md used only by the browser-less (jsdom) tests.
 * It mirrors the .NET backend's rules closely enough to exercise every screen.
 */
import type { Balances, Dashboard, Expense, ExpenseInput, Group, Person, PersonalExpense, Settlement } from '@/api/types'

const BASE = 'http://localhost:5080/api'

interface DbUser extends Person {
  email: string
  password: string
  currency: string
  createdAt: string
}
interface DbGroup {
  id: string
  name: string
  emoji: string
  color: string
  currency: string
  inviteCode: string
  simplifyDebts: boolean
  createdBy: string
  createdAt: string
  members: { userId: string; role: 'owner' | 'member'; joinedAt: string }[]
}
interface DbExpense {
  id: string
  groupId: string
  description: string
  amount: number
  category: string
  date: string
  notes: string | null
  paidBy: string
  splitType: string
  splits: { userId: string; amount: number; value: number }[]
  createdBy: string
  createdAt: string
  updatedAt: string
}
interface DbSettlement {
  id: string
  groupId: string
  fromUserId: string
  toUserId: string
  amount: number
  date: string
  note: string | null
  createdBy: string
  createdAt: string
}
interface DbPersonal extends PersonalExpense {
  userId: string
}

let seq = 0
const oid = () => (0x650000000000000000000000n + BigInt(++seq)).toString(16).padStart(24, '0')
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const now = () => new Date().toISOString()

export const db = {
  users: [] as DbUser[],
  groups: [] as DbGroup[],
  expenses: [] as DbExpense[],
  settlements: [] as DbSettlement[],
  personal: [] as DbPersonal[],
  activities: [] as { id: string; groupId: string; actorId: string; actorName: string; type: string; message: string; refId: string | null; createdAt: string }[],
  tokens: new Map<string, string>(), // accessToken -> userId
  refresh: new Map<string, string>(), // refreshToken -> userId
  calls: [] as { method: string; path: string; body: unknown }[],
}

export function reset() {
  seq = 0
  db.users = []
  db.groups = []
  db.expenses = []
  db.settlements = []
  db.personal = []
  db.activities = []
  db.tokens.clear()
  db.refresh.clear()
  db.calls = []
}

export function seed() {
  reset()
  const me = addUser('Sathish Kumar', 'sathish@example.com', 'secret1')
  const arun = addUser('Arun', 'arun@example.com', 'secret1')
  const priya = addUser('Priya', 'priya@example.com', 'secret1')
  const g: DbGroup = {
    id: oid(),
    name: 'Room 302',
    emoji: '🏠',
    color: '#E2590B',
    currency: 'INR',
    inviteCode: 'ROOM3022',
    simplifyDebts: true,
    createdBy: me.id,
    createdAt: now(),
    members: [
      { userId: me.id, role: 'owner', joinedAt: now() },
      { userId: arun.id, role: 'member', joinedAt: now() },
      { userId: priya.id, role: 'member', joinedAt: now() },
    ],
  }
  db.groups.push(g)
  const month = new Date().toISOString().slice(0, 7)
  createExpense(g, me.id, { description: 'Groceries', amount: 1500, category: 'groceries', date: `${month}-03`, paidBy: me.id, splitType: 'equal', splits: [me, arun, priya].map((u) => ({ userId: u.id, value: 0 })) })
  createExpense(g, arun.id, { description: 'Electricity bill', amount: 900, category: 'utilities', date: `${month}-05`, paidBy: arun.id, splitType: 'equal', splits: [me, arun, priya].map((u) => ({ userId: u.id, value: 0 })) })
  createExpense(g, priya.id, { description: 'Dinner', amount: 600, category: 'food', date: `${month}-06`, paidBy: priya.id, splitType: 'exact', splits: [{ userId: me.id, value: 200 }, { userId: priya.id, value: 400 }] })
  db.personal.push({ id: oid(), userId: me.id, description: 'Coffee', amount: 120, category: 'food', date: `${month}-04`, notes: null, createdAt: now(), updatedAt: now() })
  return { me, arun, priya, group: g }
}

function addUser(name: string, email: string, password: string): DbUser {
  const u: DbUser = { id: oid(), name, email, password, currency: 'INR', avatarColor: '#1D8F62', createdAt: now() }
  db.users.push(u)
  return u
}

function person(id: string): Person {
  const u = db.users.find((x) => x.id === id)
  return u ? { id: u.id, name: u.name, avatarColor: u.avatarColor } : { id, name: 'Former member', avatarColor: '#8A8F9C' }
}

function computeSplits(amount: number, type: string, paidBy: string, inputs: { userId: string; value: number }[]) {
  let splits: { userId: string; amount: number; value: number }[]
  if (type === 'equal') {
    const each = r2(amount / inputs.length)
    splits = inputs.map((i) => ({ userId: i.userId, amount: each, value: 0 }))
  } else if (type === 'exact') {
    const sum = r2(inputs.reduce((s, i) => s + i.value, 0))
    if (Math.abs(sum - amount) > 0.01) throw problem(400, `The amounts add up to ${sum.toFixed(2)}, but the expense is ${amount.toFixed(2)}.`)
    splits = inputs.map((i) => ({ userId: i.userId, amount: r2(i.value), value: i.value }))
  } else if (type === 'percent') {
    splits = inputs.map((i) => ({ userId: i.userId, amount: r2((amount * i.value) / 100), value: i.value }))
  } else {
    const total = inputs.reduce((s, i) => s + i.value, 0)
    splits = inputs.map((i) => ({ userId: i.userId, amount: r2((amount * i.value) / total), value: i.value }))
  }
  const rem = r2(amount - splits.reduce((s, x) => s + x.amount, 0))
  if (rem !== 0) {
    const t = splits.find((s) => s.userId === paidBy) ?? splits[0]
    t.amount = r2(t.amount + rem)
  }
  return splits
}

function createExpense(g: DbGroup, actor: string, input: ExpenseInput): DbExpense {
  const e: DbExpense = {
    id: oid(),
    groupId: g.id,
    description: input.description,
    amount: r2(input.amount),
    category: input.category,
    date: input.date,
    notes: input.notes ?? null,
    paidBy: input.paidBy,
    splitType: input.splitType,
    splits: computeSplits(r2(input.amount), input.splitType, input.paidBy, input.splits),
    createdBy: actor,
    createdAt: now(),
    updatedAt: now(),
  }
  db.expenses.push(e)
  log(g.id, actor, 'expense.added', `${person(actor).name} added "${e.description}" for ₹${e.amount}`, e.id)
  return e
}

function log(groupId: string, actorId: string, type: string, message: string, refId: string | null = null) {
  db.activities.push({ id: oid(), groupId, actorId, actorName: person(actorId).name, type, message, refId, createdAt: now() })
}

function totals(g: DbGroup) {
  const t = new Map<string, { paid: number; share: number; sp: number; sr: number }>()
  const get = (id: string) => {
    if (!t.has(id)) t.set(id, { paid: 0, share: 0, sp: 0, sr: 0 })
    return t.get(id)!
  }
  g.members.forEach((m) => get(m.userId))
  db.expenses.filter((e) => e.groupId === g.id).forEach((e) => {
    get(e.paidBy).paid += e.amount
    e.splits.forEach((s) => (get(s.userId).share += s.amount))
  })
  db.settlements.filter((s) => s.groupId === g.id).forEach((s) => {
    get(s.fromUserId).sp += s.amount
    get(s.toUserId).sr += s.amount
  })
  const out = new Map<string, { paid: number; share: number; balance: number }>()
  t.forEach((v, k) => out.set(k, { paid: r2(v.paid), share: r2(v.share), balance: r2(v.paid - v.share + v.sp - v.sr) }))
  return out
}

function simplify(net: Map<string, number>) {
  const debtors = [...net].filter(([, v]) => v < -0.005).map(([id, v]) => ({ id, amt: -v })).sort((a, b) => b.amt - a.amt)
  const creditors = [...net].filter(([, v]) => v > 0.005).map(([id, v]) => ({ id, amt: v })).sort((a, b) => b.amt - a.amt)
  const res: { from: string; to: string; amount: number }[] = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = r2(Math.min(debtors[i].amt, creditors[j].amt))
    if (pay > 0) res.push({ from: debtors[i].id, to: creditors[j].id, amount: pay })
    debtors[i].amt = r2(debtors[i].amt - pay)
    creditors[j].amt = r2(creditors[j].amt - pay)
    if (debtors[i].amt <= 0.005) i++
    if (creditors[j].amt <= 0.005) j++
  }
  return res
}

function groupDto(g: DbGroup, me: string): Group {
  const t = totals(g)
  const exp = db.expenses.filter((e) => e.groupId === g.id)
  const month = new Date().toISOString().slice(0, 7)
  return {
    id: g.id,
    name: g.name,
    emoji: g.emoji,
    color: g.color,
    currency: g.currency,
    inviteCode: g.inviteCode,
    simplifyDebts: g.simplifyDebts,
    createdBy: g.createdBy,
    createdAt: g.createdAt,
    members: g.members.map((m) => {
      const u = db.users.find((x) => x.id === m.userId)!
      return { userId: m.userId, name: u.name, email: u.email, avatarColor: u.avatarColor, role: m.role, joinedAt: m.joinedAt }
    }),
    myBalance: t.get(me)?.balance ?? 0,
    totalSpent: r2(exp.reduce((s, e) => s + e.amount, 0)),
    monthSpent: r2(exp.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0)),
    lastActivityAt: g.createdAt,
  }
}

function expenseDto(e: DbExpense, me: string): Expense {
  const g = db.groups.find((x) => x.id === e.groupId)!
  return {
    id: e.id,
    groupId: e.groupId,
    groupName: g.name,
    groupEmoji: g.emoji,
    description: e.description,
    amount: e.amount,
    currency: g.currency,
    category: e.category as Expense['category'],
    date: e.date,
    notes: e.notes,
    paidBy: person(e.paidBy),
    splitType: e.splitType as Expense['splitType'],
    splits: e.splits.map((s) => ({ ...person(s.userId), userId: s.userId, amount: s.amount, value: s.value })).map(({ id: _id, ...rest }) => rest),
    myShare: e.splits.filter((s) => s.userId === me).reduce((s, x) => s + x.amount, 0),
    createdBy: e.createdBy,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

function settlementDto(s: DbSettlement): Settlement {
  return { id: s.id, groupId: s.groupId, from: person(s.fromUserId), to: person(s.toUserId), amount: s.amount, date: s.date, note: s.note, createdBy: s.createdBy, createdAt: s.createdAt }
}

function balancesDto(g: DbGroup): Balances {
  const t = totals(g)
  const members = g.members.map((m) => {
    const p = person(m.userId)
    const v = t.get(m.userId)!
    return { userId: m.userId, name: p.name, avatarColor: p.avatarColor, balance: v.balance, paid: v.paid, share: v.share }
  })
  const net = new Map<string, number>()
  t.forEach((v, k) => net.set(k, v.balance))
  const debts = simplify(net).map((d) => ({ fromUserId: d.from, fromName: person(d.from).name, toUserId: d.to, toName: person(d.to).name, amount: d.amount }))
  return { simplified: g.simplifyDebts, members, debts }
}

function dashboardDto(me: string, month: string): Dashboard {
  const myGroups = db.groups.filter((g) => g.members.some((m) => m.userId === me))
  const inMonth = (d: string) => d.startsWith(month)
  const mine = db.expenses.filter((e) => myGroups.some((g) => g.id === e.groupId) && (e.paidBy === me || e.splits.some((s) => s.userId === me)))
  const share = (e: DbExpense) => e.splits.filter((s) => s.userId === me).reduce((s, x) => s + x.amount, 0)
  const monthExp = mine.filter((e) => inMonth(e.date))
  const personal = db.personal.filter((p) => p.userId === me && inMonth(p.date))
  const groupShare = r2(monthExp.reduce((s, e) => s + share(e), 0))
  const personalSpent = r2(personal.reduce((s, p) => s + p.amount, 0))
  const balances = myGroups.map((g) => ({ groupId: g.id, name: g.name, emoji: g.emoji, color: g.color, balance: totals(g).get(me)?.balance ?? 0 }))
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const daily = Array.from({ length: days }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, '0')}`
    return { date: d, amount: r2(monthExp.filter((e) => e.date === d).reduce((s, e) => s + share(e), 0) + personal.filter((p) => p.date === d).reduce((s, p) => s + p.amount, 0)) }
  })
  const byCat = new Map<string, { amount: number; count: number }>()
  for (const e of monthExp) {
    const c = byCat.get(e.category) ?? { amount: 0, count: 0 }
    byCat.set(e.category, { amount: c.amount + share(e), count: c.count + 1 })
  }
  for (const p of personal) {
    const c = byCat.get(p.category) ?? { amount: 0, count: 0 }
    byCat.set(p.category, { amount: c.amount + p.amount, count: c.count + 1 })
  }
  const meUser = db.users.find((u) => u.id === me)!
  const recent: Expense[] = [
    ...mine.map((e) => expenseDto(e, me)),
    ...db.personal.filter((p) => p.userId === me).map<Expense>((p) => ({
      id: p.id, groupId: 'personal', groupName: 'Personal', groupEmoji: '👤', description: p.description, amount: p.amount, currency: meUser.currency,
      category: p.category, date: p.date, notes: p.notes, paidBy: person(me), splitType: 'equal', splits: [{ ...person(me), userId: me, amount: p.amount, value: 0 }].map(({ id: _id, ...r }) => r),
      myShare: p.amount, createdBy: me, createdAt: p.createdAt, updatedAt: p.updatedAt,
    })),
  ].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 10)

  return {
    month,
    totalSpent: r2(groupShare + personalSpent),
    groupShare,
    personalSpent,
    iPaid: r2(monthExp.filter((e) => e.paidBy === me).reduce((s, e) => s + e.amount, 0)),
    prevMonthTotal: 0,
    youOwe: r2(balances.filter((b) => b.balance < 0).reduce((s, b) => s - b.balance, 0)),
    youAreOwed: r2(balances.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0)),
    netBalance: r2(balances.reduce((s, b) => s + b.balance, 0)),
    byGroup: [
      ...myGroups.map((g) => ({ groupId: g.id, name: g.name, emoji: g.emoji, color: g.color, amount: r2(monthExp.filter((e) => e.groupId === g.id).reduce((s, e) => s + share(e), 0)), count: monthExp.filter((e) => e.groupId === g.id).length })).filter((x) => x.amount > 0),
      ...(personal.length ? [{ groupId: 'personal', name: 'Personal', emoji: '👤', color: '#8A8F9C', amount: personalSpent, count: personal.length }] : []),
    ],
    byCategory: [...byCat].map(([category, v]) => ({ category: category as Expense['category'], amount: r2(v.amount), count: v.count })),
    daily,
    groupBalances: balances,
    recent,
  }
}

class Problem extends Error {
  constructor(public status: number, public detail: string) {
    super(detail)
  }
}
const problem = (status: number, detail: string) => new Problem(status, detail)

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function issueTokens(userId: string) {
  const accessToken = `at-${oid()}`
  const refreshToken = `rt-${oid()}`
  db.tokens.set(accessToken, userId)
  db.refresh.set(refreshToken, userId)
  return { accessToken, refreshToken, accessTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString() }
}

/** Set to true to make the next authenticated request answer 401 (tests the refresh flow). */
export const flags = { expireAccessOnce: false }

export async function handle(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = input instanceof Request ? input : null
  const url = req ? req.url : typeof input === 'string' ? input : input.toString()
  if (!url.startsWith(BASE)) return json(404, { status: 404, title: 'Not found', detail: `Unknown URL ${url}` })
  const method = (req?.method ?? init?.method ?? 'GET').toUpperCase()
  const u = new URL(url)
  const path = u.pathname.slice(new URL(BASE).pathname.length)
  const rawBody = req ? await req.text() : init?.body ? String(init.body) : ''
  const body = rawBody ? JSON.parse(rawBody) : undefined
  db.calls.push({ method, path, body })
  const headers = new Headers(req ? req.headers : init?.headers)

  try {
    // ----- anonymous -----
    if (method === 'POST' && path === '/auth/login') {
      const user = db.users.find((x) => x.email === String(body.email).toLowerCase().trim())
      if (!user || user.password !== body.password) throw problem(401, 'Email or password is incorrect.')
      return json(200, { user: userDto(user), ...issueTokens(user.id) })
    }
    if (method === 'POST' && path === '/auth/register') {
      if (db.users.some((x) => x.email === String(body.email).toLowerCase())) throw problem(409, 'An account with that email already exists. Try signing in.')
      const user = addUser(body.name, String(body.email).toLowerCase(), body.password)
      return json(201, { user: userDto(user), ...issueTokens(user.id) })
    }
    if (method === 'POST' && path === '/auth/refresh') {
      const uid = db.refresh.get(body.refreshToken)
      if (!uid) throw problem(401, 'Your session has expired. Please sign in again.')
      db.refresh.delete(body.refreshToken)
      return json(200, issueTokens(uid))
    }
    if (method === 'POST' && path === '/auth/logout') return json(204, undefined)

    // ----- auth -----
    const token = headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    if (flags.expireAccessOnce) {
      flags.expireAccessOnce = false
      return json(401, undefined)
    }
    const me = db.tokens.get(token)
    if (!me) return json(401, undefined)
    const meUser = db.users.find((x) => x.id === me)!

    const groupOf = (id: string) => {
      const g = db.groups.find((x) => x.id === id)
      if (!g) throw problem(404, 'Group not found.')
      if (!g.members.some((m) => m.userId === me)) throw problem(403, 'You are not a member of this group.')
      return g
    }

    let m: RegExpExecArray | null
    if (method === 'GET' && path === '/auth/me') return json(200, userDto(meUser))
    if (method === 'PUT' && path === '/auth/me') {
      Object.assign(meUser, { name: body.name ?? meUser.name, currency: body.currency ?? meUser.currency, avatarColor: body.avatarColor ?? meUser.avatarColor })
      return json(200, userDto(meUser))
    }
    if (method === 'PUT' && path === '/auth/password') {
      if (meUser.password !== body.currentPassword) throw problem(400, 'Current password is incorrect.')
      meUser.password = body.newPassword
      return json(204, undefined)
    }
    if (method === 'GET' && path === '/users/lookup') {
      const email = String(u.searchParams.get('email')).toLowerCase()
      const found = db.users.find((x) => x.email === email)
      if (!found) throw problem(404, 'No Kanakku account with that email yet.')
      return json(200, person(found.id))
    }
    if (method === 'GET' && path === '/groups') return json(200, db.groups.filter((g) => g.members.some((x) => x.userId === me)).map((g) => groupDto(g, me)))
    if (method === 'POST' && path === '/groups') {
      const g: DbGroup = { id: oid(), name: body.name, emoji: body.emoji ?? '🏠', color: body.color ?? '#E2590B', currency: body.currency ?? 'INR', inviteCode: 'NEW' + String(seq).padStart(5, '0'), simplifyDebts: true, createdBy: me, createdAt: now(), members: [{ userId: me, role: 'owner', joinedAt: now() }] }
      db.groups.push(g)
      return json(201, groupDto(g, me))
    }
    if (method === 'POST' && path === '/groups/join') {
      const g = db.groups.find((x) => x.inviteCode === String(body.inviteCode).toUpperCase())
      if (!g) throw problem(404, "That invite code didn't match any group.")
      if (!g.members.some((x) => x.userId === me)) g.members.push({ userId: me, role: 'member', joinedAt: now() })
      return json(200, groupDto(g, me))
    }
    if ((m = /^\/groups\/([a-f0-9]{24})$/.exec(path))) {
      const g = groupOf(m[1])
      if (method === 'GET') return json(200, groupDto(g, me))
      if (method === 'PUT') {
        Object.assign(g, { name: body.name ?? g.name, emoji: body.emoji ?? g.emoji, color: body.color ?? g.color, simplifyDebts: body.simplifyDebts ?? g.simplifyDebts })
        return json(200, groupDto(g, me))
      }
      if (method === 'DELETE') {
        db.groups = db.groups.filter((x) => x.id !== g.id)
        return json(204, undefined)
      }
    }
    if ((m = /^\/groups\/([a-f0-9]{24})\/balances$/.exec(path))) return json(200, balancesDto(groupOf(m[1])))
    if ((m = /^\/groups\/([a-f0-9]{24})\/activity$/.exec(path))) return json(200, db.activities.filter((a) => a.groupId === m![1]).reverse())
    if ((m = /^\/groups\/([a-f0-9]{24})\/invite\/regenerate$/.exec(path))) {
      const g = groupOf(m[1])
      g.inviteCode = 'REGEN' + String(seq).padStart(3, '0')
      return json(200, { inviteCode: g.inviteCode })
    }
    if ((m = /^\/groups\/([a-f0-9]{24})\/members$/.exec(path)) && method === 'POST') {
      const g = groupOf(m[1])
      const u = db.users.find((x) => x.email === String(body.email).toLowerCase())
      if (!u) throw problem(404, 'No Kanakku account with that email. Ask them to sign up first, or share the invite code.')
      if (g.members.some((x) => x.userId === u.id)) throw problem(409, `${u.name} is already in this group.`)
      g.members.push({ userId: u.id, role: 'member', joinedAt: now() })
      return json(200, groupDto(g, me))
    }
    if ((m = /^\/groups\/([a-f0-9]{24})\/members\/([a-f0-9]{24})$/.exec(path)) && method === 'DELETE') {
      const g = groupOf(m[1])
      const bal = totals(g).get(m[2])?.balance ?? 0
      if (Math.abs(bal) > 0.005) throw problem(409, `${person(m[2]).name} still has a balance of ₹${Math.abs(bal)} in this group. Settle up first.`)
      g.members = g.members.filter((x) => x.userId !== m![2])
      return json(204, undefined)
    }
    if ((m = /^\/groups\/([a-f0-9]{24})\/expenses$/.exec(path))) {
      const g = groupOf(m[1])
      if (method === 'GET') {
        const month = u.searchParams.get('month')
        const category = u.searchParams.get('category')
        const search = u.searchParams.get('search')?.toLowerCase()
        const items = db.expenses
          .filter((e) => e.groupId === g.id && (!month || e.date.startsWith(month)) && (!category || e.category === category) && (!search || e.description.toLowerCase().includes(search)))
          .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
          .map((e) => expenseDto(e, me))
        return json(200, { items, total: items.length, page: 1, pageSize: 50 })
      }
      if (method === 'POST') return json(201, expenseDto(createExpense(g, me, body), me))
    }
    if (method === 'GET' && path === '/expenses/recent') {
      return json(200, db.expenses.filter((e) => e.paidBy === me || e.splits.some((s) => s.userId === me)).map((e) => expenseDto(e, me)))
    }
    if ((m = /^\/expenses\/([a-f0-9]{24})$/.exec(path))) {
      const e = db.expenses.find((x) => x.id === m![1])
      if (!e) throw problem(404, 'Expense not found.')
      const g = groupOf(e.groupId)
      if (method === 'GET') return json(200, expenseDto(e, me))
      if (method === 'PUT') {
        Object.assign(e, { description: body.description, amount: r2(body.amount), category: body.category, date: body.date, notes: body.notes ?? null, paidBy: body.paidBy, splitType: body.splitType, splits: computeSplits(r2(body.amount), body.splitType, body.paidBy, body.splits), updatedAt: now() })
        log(g.id, me, 'expense.updated', `${meUser.name} updated "${e.description}"`, e.id)
        return json(200, expenseDto(e, me))
      }
      if (method === 'DELETE') {
        db.expenses = db.expenses.filter((x) => x.id !== e.id)
        log(g.id, me, 'expense.deleted', `${meUser.name} deleted "${e.description}"`, e.id)
        return json(204, undefined)
      }
    }
    if ((m = /^\/groups\/([a-f0-9]{24})\/settlements$/.exec(path))) {
      const g = groupOf(m[1])
      if (method === 'GET') return json(200, db.settlements.filter((s) => s.groupId === g.id).map(settlementDto))
      if (method === 'POST') {
        if (body.fromUserId === body.toUserId) throw problem(400, 'Payer and receiver must be different people.')
        const s: DbSettlement = { id: oid(), groupId: g.id, fromUserId: body.fromUserId, toUserId: body.toUserId, amount: r2(body.amount), date: body.date ?? new Date().toISOString().slice(0, 10), note: body.note ?? null, createdBy: me, createdAt: now() }
        db.settlements.push(s)
        log(g.id, me, 'settlement.added', `${person(s.fromUserId).name} paid ${person(s.toUserId).name} ₹${s.amount}`, s.id)
        return json(201, settlementDto(s))
      }
    }
    if ((m = /^\/settlements\/([a-f0-9]{24})$/.exec(path)) && method === 'DELETE') {
      db.settlements = db.settlements.filter((s) => s.id !== m![1])
      return json(204, undefined)
    }
    if (path === '/personal' && method === 'GET') {
      const month = u.searchParams.get('month')
      return json(200, db.personal.filter((p) => p.userId === me && (!month || p.date.startsWith(month))).sort((a, b) => b.date.localeCompare(a.date)).map(({ userId: _u, ...p }) => p))
    }
    if (path === '/personal' && method === 'POST') {
      const p: DbPersonal = { id: oid(), userId: me, description: body.description, amount: r2(body.amount), category: body.category, date: body.date, notes: body.notes ?? null, createdAt: now(), updatedAt: now() }
      db.personal.push(p)
      const { userId: _u, ...dto } = p
      return json(201, dto)
    }
    if ((m = /^\/personal\/([a-f0-9]{24})$/.exec(path))) {
      const p = db.personal.find((x) => x.id === m![1] && x.userId === me)
      if (!p) throw problem(404, 'Expense not found.')
      if (method === 'PUT') {
        Object.assign(p, { description: body.description, amount: r2(body.amount), category: body.category, date: body.date, notes: body.notes ?? null, updatedAt: now() })
        const { userId: _u, ...dto } = p
        return json(200, dto)
      }
      if (method === 'DELETE') {
        db.personal = db.personal.filter((x) => x.id !== p.id)
        return json(204, undefined)
      }
    }
    if (path === '/dashboard' && method === 'GET') return json(200, dashboardDto(me, u.searchParams.get('month') ?? new Date().toISOString().slice(0, 7)))
    if (path === '/reports/months' && method === 'GET') {
      const months = new Set<string>([...db.expenses.map((e) => e.date.slice(0, 7)), ...db.personal.map((p) => p.date.slice(0, 7)), new Date().toISOString().slice(0, 7)])
      return json(200, [...months].sort().reverse())
    }
    if (path === '/reports/monthly' && method === 'GET') {
      const fmt = u.searchParams.get('format')
      return new Response(fmt === 'csv' ? 'Date,Group\n' : '%PDF-1.4 fake', { status: 200, headers: { 'Content-Type': fmt === 'csv' ? 'text/csv' : 'application/pdf', 'Content-Disposition': `attachment; filename="kanakku-${u.searchParams.get('month')}.${fmt}"` } })
    }
    return json(404, { status: 404, title: 'Not found', detail: `No route for ${method} ${path}` })
  } catch (e) {
    if (e instanceof Problem) return json(e.status, { status: e.status, title: 'Error', detail: e.detail })
    throw e
  }
}

function userDto(u: DbUser) {
  return { id: u.id, name: u.name, email: u.email, currency: u.currency, avatarColor: u.avatarColor, createdAt: u.createdAt }
}

/** Installs the fake as global fetch. */
export function install() {
  globalThis.fetch = handle as typeof fetch
}
