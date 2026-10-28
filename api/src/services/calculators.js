/**
 * Pure money maths shared by groups, dashboard and reports. See docs/API.md "Balance rules".
 * All ids are compared as strings. All money is rounded to 2 dp.
 */
import { ApiError } from '../lib/errors.js'
import { round2, sameId } from '../lib/util.js'

const s = (id) => String(id)

/**
 * Per-member totals for a group.
 * balance = paid − share + settlementsPaid − settlementsReceived  (+ = others owe me, − = I owe)
 */
export function memberTotals(memberIds, expenses, settlements) {
  const totals = new Map()
  const get = (id) => {
    const key = s(id)
    if (!totals.has(key)) totals.set(key, { paid: 0, share: 0, settledPaid: 0, settledReceived: 0 })
    return totals.get(key)
  }
  for (const id of memberIds) get(id)
  for (const e of expenses) {
    get(e.paidBy).paid += e.amount
    for (const sp of e.splits) get(sp.userId).share += sp.amount
  }
  for (const st of settlements) {
    get(st.fromUserId).settledPaid += st.amount
    get(st.toUserId).settledReceived += st.amount
  }
  const out = new Map()
  for (const [id, t] of totals) {
    out.set(id, {
      paid: round2(t.paid),
      share: round2(t.share),
      balance: round2(t.paid - t.share + t.settledPaid - t.settledReceived),
    })
  }
  return out
}

/** Minimum-ish number of transfers: greedy largest debtor → largest creditor. net: Map<id, balance>. */
export function simplifyDebts(net) {
  const debtors = [...net].filter(([, v]) => v < -0.005).map(([id, v]) => ({ id, amt: -v })).sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id))
  const creditors = [...net].filter(([, v]) => v > 0.005).map(([id, v]) => ({ id, amt: v })).sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id))
  const result = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = round2(Math.min(debtors[i].amt, creditors[j].amt))
    if (pay > 0) result.push({ fromUserId: debtors[i].id, toUserId: creditors[j].id, amount: pay })
    debtors[i].amt = round2(debtors[i].amt - pay)
    creditors[j].amt = round2(creditors[j].amt - pay)
    if (debtors[i].amt <= 0.005) i++
    if (creditors[j].amt <= 0.005) j++
  }
  return result
}

/** Actual pairwise debts (no simplification), net of the reverse direction and of settlements. */
export function pairwiseDebts(expenses, settlements) {
  const owes = new Map() // "a|b" → how much a owes b
  const add = (a, b, amount) => {
    if (sameId(a, b)) return
    const key = `${s(a)}|${s(b)}`
    owes.set(key, (owes.get(key) ?? 0) + amount)
  }
  for (const e of expenses) for (const sp of e.splits) add(sp.userId, e.paidBy, sp.amount)
  for (const st of settlements) add(st.fromUserId, st.toUserId, -st.amount)

  const result = []
  const seen = new Set()
  for (const key of owes.keys()) {
    const [a, b] = key.split('|')
    const pair = a < b ? `${a}|${b}` : `${b}|${a}`
    if (seen.has(pair)) continue
    seen.add(pair)
    const net = round2((owes.get(`${a}|${b}`) ?? 0) - (owes.get(`${b}|${a}`) ?? 0))
    if (net > 0.005) result.push({ fromUserId: a, toUserId: b, amount: net })
    else if (net < -0.005) result.push({ fromUserId: b, toUserId: a, amount: -net })
  }
  return result.sort((x, y) => y.amount - x.amount)
}

export function groupDebts(group, expenses, settlements, totals) {
  if (!group.simplifyDebts) return pairwiseDebts(expenses, settlements)
  const net = new Map()
  for (const [id, t] of totals) net.set(id, t.balance)
  return simplifyDebts(net)
}

/**
 * Turns an ExpenseInput's splits into exact rupee amounts that always sum to the total.
 * Rounding remainder goes to the payer's own split (or the first split if the payer isn't in it).
 */
export function computeSplits(amount, splitType, paidBy, inputs) {
  if (!inputs?.length) throw ApiError.badRequest('Select at least one person to split with.', 'splits')
  const ids = inputs.map((i) => s(i.userId))
  if (new Set(ids).size !== ids.length) throw ApiError.badRequest('A person appears twice in the split.', 'splits')

  amount = round2(amount)
  let splits
  switch (splitType) {
    case 'equal': {
      const each = round2(amount / inputs.length)
      splits = inputs.map((i) => ({ userId: i.userId, amount: each, value: 0 }))
      break
    }
    case 'exact': {
      if (inputs.some((i) => i.value < 0)) throw ApiError.badRequest('Amounts cannot be negative.', 'splits')
      const total = round2(inputs.reduce((t, i) => t + i.value, 0))
      if (Math.abs(total - amount) > 0.01)
        throw ApiError.badRequest(`The amounts add up to ${total.toFixed(2)}, but the expense is ${amount.toFixed(2)}.`, 'splits')
      splits = inputs.map((i) => ({ userId: i.userId, amount: round2(i.value), value: i.value }))
      break
    }
    case 'percent': {
      if (inputs.some((i) => i.value < 0)) throw ApiError.badRequest('Percentages cannot be negative.', 'splits')
      const total = inputs.reduce((t, i) => t + i.value, 0)
      if (Math.abs(total - 100) > 0.01) throw ApiError.badRequest(`Percentages add up to ${round2(total)}%, they must total 100%.`, 'splits')
      splits = inputs.map((i) => ({ userId: i.userId, amount: round2((amount * i.value) / 100), value: i.value }))
      break
    }
    case 'shares': {
      if (inputs.some((i) => !(i.value > 0))) throw ApiError.badRequest('Shares must be greater than 0.', 'splits')
      const total = inputs.reduce((t, i) => t + i.value, 0)
      splits = inputs.map((i) => ({ userId: i.userId, amount: round2((amount * i.value) / total), value: i.value }))
      break
    }
    default:
      throw ApiError.badRequest('Split type must be equal, exact, percent or shares.', 'splitType')
  }

  const remainder = round2(amount - splits.reduce((t, x) => t + x.amount, 0))
  if (remainder !== 0) {
    const target = splits.find((x) => sameId(x.userId, paidBy)) ?? splits[0]
    target.amount = round2(target.amount + remainder)
  }
  return splits
}

export const shareOf = (expense, userId) => round2(expense.splits.filter((sp) => sameId(sp.userId, userId)).reduce((t, sp) => t + sp.amount, 0))
export const involves = (expense, userId) => sameId(expense.paidBy, userId) || expense.splits.some((sp) => sameId(sp.userId, userId))
