import { dayKey, idStr, round2, sum } from '../lib/util.js'
import { memberTotals, shareOf } from './calculators.js'

const FORMER = { name: 'Former member', avatarColor: '#8A8F9C' }

/** Map<idString, user> from an array of users. */
export const userMap = (users) => new Map(users.map((u) => [String(u._id), u]))

export function person(id, users) {
  const u = users.get(String(id))
  return u ? { id: String(u._id), name: u.name, avatarColor: u.avatarColor } : { id: String(id), ...FORMER }
}

export const userDto = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  currency: u.currency,
  avatarColor: u.avatarColor,
  createdAt: u.createdAt,
})

export function expenseDto(e, group, users, me) {
  return {
    id: String(e._id),
    groupId: String(e.groupId),
    groupName: group.name,
    groupEmoji: group.emoji,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    category: e.category,
    date: dayKey(e.date),
    notes: e.notes ?? null,
    paidBy: person(e.paidBy, users),
    splitType: e.splitType,
    splits: e.splits.map((sp) => {
      const p = person(sp.userId, users)
      return { userId: p.id, name: p.name, avatarColor: p.avatarColor, amount: sp.amount, value: sp.value ?? 0 }
    }),
    myShare: shareOf(e, me),
    createdBy: String(e.createdBy),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

/** A personal expense shaped like a group expense, for the dashboard's flat "recent" list. */
export function personalAsExpenseDto(p, me) {
  const who = { id: String(me._id), name: me.name, avatarColor: me.avatarColor }
  return {
    id: String(p._id),
    groupId: 'personal',
    groupName: 'Personal',
    groupEmoji: '👤',
    description: p.description,
    amount: p.amount,
    currency: me.currency,
    category: p.category,
    date: dayKey(p.date),
    notes: p.notes ?? null,
    paidBy: who,
    splitType: 'equal',
    splits: [{ userId: who.id, name: who.name, avatarColor: who.avatarColor, amount: p.amount, value: 0 }],
    myShare: p.amount,
    createdBy: who.id,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

export const settlementDto = (st, users) => ({
  id: String(st._id),
  groupId: String(st.groupId),
  from: person(st.fromUserId, users),
  to: person(st.toUserId, users),
  amount: st.amount,
  date: dayKey(st.date),
  note: st.note ?? null,
  createdBy: String(st.createdBy),
  createdAt: st.createdAt,
})

export const personalDto = (p) => ({
  id: String(p._id),
  description: p.description,
  amount: p.amount,
  category: p.category,
  date: dayKey(p.date),
  notes: p.notes ?? null,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
})

export const activityDto = (a) => ({
  id: String(a._id),
  groupId: String(a.groupId),
  actorId: String(a.actorId),
  actorName: a.actorName,
  type: a.type,
  message: a.message,
  refId: a.refId ?? null,
  createdAt: a.createdAt,
})

export function groupDto(g, users, expenses, settlements, me, range) {
  const totals = memberTotals(g.members.map((m) => m.userId), expenses, settlements)
  const myBalance = totals.get(String(me))?.balance ?? 0
  let last = g.createdAt
  for (const e of expenses) if (e.createdAt > last) last = e.createdAt
  for (const st of settlements) if (st.createdAt > last) last = st.createdAt

  return {
    id: String(g._id),
    name: g.name,
    emoji: g.emoji,
    color: g.color,
    currency: g.currency,
    inviteCode: g.inviteCode,
    simplifyDebts: g.simplifyDebts,
    createdBy: String(g.createdBy),
    createdAt: g.createdAt,
    members: [...g.members]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((m) => {
        const u = users.get(String(m.userId))
        return {
          userId: String(m.userId),
          name: u?.name ?? FORMER.name,
          email: u?.email ?? '',
          avatarColor: u?.avatarColor ?? FORMER.avatarColor,
          role: m.role,
          joinedAt: m.joinedAt,
        }
      }),
    myBalance,
    totalSpent: sum(expenses, (e) => e.amount),
    monthSpent: round2(expenses.filter((e) => e.date >= range.start && e.date < range.end).reduce((t, e) => t + e.amount, 0)),
    lastActivityAt: last,
  }
}

export const idOf = idStr
