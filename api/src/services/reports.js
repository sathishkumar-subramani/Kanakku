import { ApiError } from '../lib/errors.js'
import { dayKey, monthKey, monthLabel, monthRange, round2, sameId, sum } from '../lib/util.js'
import { shareOf } from './calculators.js'
import { expenseDto, person, personalAsExpenseDto } from './mappers.js'
import { loadLedger } from './data.js'

// ---------- dashboard ----------

export async function buildDashboard(userId, month) {
  const L = await loadLedger(userId)
  const me = L.me
  const myId = String(me._id)
  const range = monthRange(month)
  const prevStart = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth() - 1, 1))
  const prevRange = { start: prevStart, end: range.start }

  const monthExpenses = L.inRange(L.myExpenses, range)
  const monthPersonal = L.inRange(L.personal, range)

  const groupShare = sum(monthExpenses, (e) => shareOf(e, myId))
  const personalSpent = sum(monthPersonal, (p) => p.amount)
  const iPaid = sum(monthExpenses.filter((e) => sameId(e.paidBy, myId)), (e) => e.amount)
  const totalSpent = round2(groupShare + personalSpent)
  const prevMonthTotal = round2(sum(L.inRange(L.myExpenses, prevRange), (e) => shareOf(e, myId)) + sum(L.inRange(L.personal, prevRange), (p) => p.amount))

  const balances = L.myBalances()
  const values = [...balances.values()]
  const youOwe = sum(values.filter((b) => b < 0), (b) => -b)
  const youAreOwed = sum(values.filter((b) => b > 0))
  const netBalance = sum(values)

  // by group (my share) + personal bucket
  const byGroupMap = new Map()
  for (const e of monthExpenses) {
    const share = shareOf(e, myId)
    if (share <= 0) continue
    const gid = String(e.groupId)
    const cur = byGroupMap.get(gid) ?? { amount: 0, count: 0 }
    byGroupMap.set(gid, { amount: cur.amount + share, count: cur.count + 1 })
  }
  const byGroup = [...byGroupMap].map(([gid, v]) => {
    const g = L.groupMap.get(gid)
    return { groupId: gid, name: g.name, emoji: g.emoji, color: g.color, amount: round2(v.amount), count: v.count }
  })
  if (monthPersonal.length) byGroup.push({ groupId: 'personal', name: 'Personal', emoji: '👤', color: '#8A8F9C', amount: personalSpent, count: monthPersonal.length })
  byGroup.sort((a, b) => b.amount - a.amount)

  // by category (my share + personal)
  const byCatMap = new Map()
  const addCat = (cat, amount) => {
    const cur = byCatMap.get(cat) ?? { amount: 0, count: 0 }
    byCatMap.set(cat, { amount: cur.amount + amount, count: cur.count + 1 })
  }
  for (const e of monthExpenses) {
    const share = shareOf(e, myId)
    if (share > 0) addCat(e.category, share)
  }
  for (const p of monthPersonal) addCat(p.category, p.amount)
  const byCategory = [...byCatMap].map(([category, v]) => ({ category, amount: round2(v.amount), count: v.count })).sort((a, b) => b.amount - a.amount)

  // daily (every day of the month)
  const days = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth() + 1, 0)).getUTCDate()
  const perDay = new Array(days + 1).fill(0)
  for (const e of monthExpenses) perDay[e.date.getUTCDate()] += shareOf(e, myId)
  for (const p of monthPersonal) perDay[p.date.getUTCDate()] += p.amount
  const daily = []
  for (let d = 1; d <= days; d++) {
    daily.push({ date: dayKey(new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), d))), amount: round2(perDay[d]) })
  }

  const groupBalances = L.groups
    .map((g) => ({ groupId: String(g._id), name: g.name, emoji: g.emoji, color: g.color, balance: balances.get(String(g._id)) ?? 0 }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

  const recent = [
    ...L.myExpenses.map((e) => expenseDto(e, L.groupMap.get(String(e.groupId)), L.users, myId)),
    ...L.personal.map((p) => personalAsExpenseDto(p, me)),
  ]
    .sort((a, b) => (b.date + b.createdAt.toISOString()).localeCompare(a.date + a.createdAt.toISOString()))
    .slice(0, 10)

  return { month: range.key, totalSpent, groupShare, personalSpent, iPaid, prevMonthTotal, youOwe, youAreOwed, netBalance, byGroup, byCategory, daily, groupBalances, recent }
}

// ---------- monthly report model (shared by PDF + CSV) ----------

export async function reportMonths(userId) {
  const L = await loadLedger(userId)
  const months = new Set([...L.myExpenses.map((e) => monthKey(e.date)), ...L.personal.map((p) => monthKey(p.date)), monthKey(new Date())])
  return [...months].sort().reverse()
}

export async function buildReport(userId, month, groupId) {
  const L = await loadLedger(userId)
  const me = L.me
  const myId = String(me._id)
  const range = monthRange(month)

  const personalOnly = typeof groupId === 'string' && groupId.toLowerCase() === 'personal'
  let onlyGroup = null
  if (groupId && !personalOnly) {
    onlyGroup = L.groupMap.get(groupId)
    if (!onlyGroup) throw ApiError.notFound('Group')
  }

  const expenses = personalOnly ? [] : L.inRange(L.myExpenses, range).filter((e) => !onlyGroup || sameId(e.groupId, onlyGroup._id))
  const personal = onlyGroup ? [] : L.inRange(L.personal, range)
  const settlements = personalOnly
    ? []
    : L.inRange(L.settlements, range).filter((s) => (!onlyGroup || sameId(s.groupId, onlyGroup._id)) && (sameId(s.fromUserId, myId) || sameId(s.toUserId, myId)))

  const name = (id) => (sameId(id, myId) ? 'You' : person(id, L.users).name)
  const groupName = (gid) => L.groupMap.get(String(gid))?.name ?? 'Group'

  const lines = [
    ...expenses.map((e) => ({ date: e.date, group: groupName(e.groupId), description: e.description, category: e.category, paidBy: name(e.paidBy), total: e.amount, myShare: shareOf(e, myId), notes: e.notes ?? '' })),
    ...personal.map((p) => ({ date: p.date, group: 'Personal', description: p.description, category: p.category, paidBy: 'You', total: p.amount, myShare: p.amount, notes: p.notes ?? '' })),
  ].sort((a, b) => a.date - b.date || a.description.localeCompare(b.description))

  const groupShare = sum(expenses, (e) => shareOf(e, myId))
  const personalSpent = sum(personal, (p) => p.amount)

  const bucket = (items, keyOf, amountOf) => {
    const m = new Map()
    for (const it of items) {
      const k = keyOf(it)
      const cur = m.get(k) ?? { amount: 0, count: 0 }
      m.set(k, { amount: cur.amount + amountOf(it), count: cur.count + 1 })
    }
    return [...m].map(([name, v]) => ({ name, amount: round2(v.amount), count: v.count })).filter((b) => b.amount > 0).sort((a, b) => b.amount - a.amount)
  }

  const byGroup = bucket(expenses, (e) => groupName(e.groupId), (e) => shareOf(e, myId))
  if (personal.length) byGroup.push({ name: 'Personal', amount: personalSpent, count: personal.length })
  byGroup.sort((a, b) => b.amount - a.amount)
  const byCategory = bucket(lines, (l) => l.category, (l) => l.myShare)

  const balances = L.myBalances()
  const balanceRows = personalOnly ? [] : L.groups.filter((g) => !onlyGroup || sameId(g._id, onlyGroup._id)).map((g) => ({ group: g.name, balance: balances.get(String(g._id)) ?? 0 }))

  return {
    month: range.key,
    monthLabel: monthLabel(range.key),
    userName: me.name,
    currency: me.currency,
    scope: personalOnly ? 'Personal expenses only' : onlyGroup ? `Group: ${onlyGroup.name}` : 'All groups + personal',
    scopeSlug: personalOnly ? 'personal' : onlyGroup ? slug(onlyGroup.name) : '',
    totalSpent: round2(groupShare + personalSpent),
    groupShare,
    personalSpent,
    iPaid: sum(expenses.filter((e) => sameId(e.paidBy, myId)), (e) => e.amount),
    byGroup,
    byCategory,
    lines,
    settlements: settlements
      .map((s) => ({ date: s.date, group: groupName(s.groupId), from: name(s.fromUserId), to: name(s.toUserId), amount: s.amount }))
      .sort((a, b) => a.date - b.date),
    balances: balanceRows,
  }
}

function slug(s) {
  const out = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return out || 'group'
}

// ---------- CSV ----------

const csvCell = (v) => {
  let s = String(v ?? '')
  // Neutralise spreadsheet formula injection ("=HYPERLINK(...)", "+cmd", "@SUM", ...).
  if (/^[=+@\t\r]|^-[^0-9.]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function reportToCsv(r) {
  const rows = [['Date', 'Group', 'Description', 'Category', 'Paid by', 'Total', 'My share', 'Notes']]
  for (const l of r.lines) rows.push([dayKey(l.date), l.group, l.description, l.category, l.paidBy, l.total.toFixed(2), l.myShare.toFixed(2), l.notes])
  rows.push([])
  rows.push([`Total this month (${r.currency})`, r.totalSpent.toFixed(2)])
  rows.push(['Group share', r.groupShare.toFixed(2)])
  rows.push(['Personal', r.personalSpent.toFixed(2)])
  rows.push(['I paid (groups)', r.iPaid.toFixed(2)])
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
