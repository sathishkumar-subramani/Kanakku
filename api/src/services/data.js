import { ApiError } from '../lib/errors.js'
import { ensureObjectId, monthRange, oid, sameId } from '../lib/util.js'
import { Activity, Expense, Group, PersonalExpense, Settlement, User } from '../models/index.js'
import { memberTotals, involves } from './calculators.js'
import { groupDto, userMap } from './mappers.js'

// ---------- users ----------

export async function usersById(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))]
  if (unique.length === 0) return new Map()
  const users = await User.find({ _id: { $in: unique.map(oid) } }).lean()
  return userMap(users)
}

export async function requireUser(userId) {
  const user = await User.findById(userId).lean()
  if (!user) throw ApiError.unauthorized('Account not found. Please sign in again.')
  return user
}

// ---------- groups ----------

export const isMember = (group, userId) => group.members.some((m) => sameId(m.userId, userId))
export const isOwner = (group, userId) => group.members.some((m) => sameId(m.userId, userId) && m.role === 'owner')
export const memberIds = (group) => group.members.map((m) => String(m.userId))

/** Loads a group and checks membership (404 if missing, 403 if not a member). */
export async function requireMember(groupId, userId) {
  const id = ensureObjectId(groupId, 'Group')
  const group = await Group.findById(id).lean()
  if (!group) throw ApiError.notFound('Group')
  if (!isMember(group, userId)) throw ApiError.forbidden('You are not a member of this group.')
  return group
}

export const myGroups = (userId) => Group.find({ 'members.userId': oid(userId) }).sort({ name: 1 }).lean()

export const expensesOf = (groupIds) => (groupIds.length ? Expense.find({ groupId: { $in: groupIds.map(oid) } }).lean() : Promise.resolve([]))
export const settlementsOf = (groupIds) => (groupIds.length ? Settlement.find({ groupId: { $in: groupIds.map(oid) } }).lean() : Promise.resolve([]))

/** Full GroupDto for one group (loads its expenses, settlements and members). */
export async function groupToDto(group, me, month) {
  const [expenses, settlements, users] = await Promise.all([
    Expense.find({ groupId: group._id }).lean(),
    Settlement.find({ groupId: group._id }).lean(),
    usersById(memberIds(group)),
  ])
  return groupDto(group, users, expenses, settlements, me, monthRange(month))
}

// ---------- activity ----------

export async function logActivity(groupId, actor, type, message, refId = null) {
  await Activity.create({ groupId: oid(groupId), actorId: actor._id, actorName: actor.name, type, message, refId: refId ? String(refId) : null })
}

// ---------- ledger: everything the dashboard and reports need, loaded once ----------

export async function loadLedger(userId) {
  const me = await requireUser(userId)
  const groups = await myGroups(userId)
  const ids = groups.map((g) => String(g._id))
  const [expenses, settlements, personal] = await Promise.all([
    expensesOf(ids),
    settlementsOf(ids),
    PersonalExpense.find({ userId: me._id }).lean(),
  ])
  const users = await usersById([
    ...groups.flatMap(memberIds),
    ...expenses.map((e) => e.paidBy),
    ...expenses.flatMap((e) => e.splits.map((s) => s.userId)),
    ...settlements.flatMap((s) => [s.fromUserId, s.toUserId]),
    me._id,
  ])
  const groupMap = new Map(groups.map((g) => [String(g._id), g]))
  const myExpenses = expenses.filter((e) => involves(e, me._id))

  const inRange = (items, r) => items.filter((x) => x.date >= r.start && x.date < r.end)

  /** My net balance per group (all time): Map<groupId, balance>. */
  function myBalances() {
    const out = new Map()
    for (const g of groups) {
      const gid = String(g._id)
      const totals = memberTotals(
        memberIds(g),
        expenses.filter((e) => sameId(e.groupId, gid)),
        settlements.filter((s) => sameId(s.groupId, gid)),
      )
      out.set(gid, totals.get(String(me._id))?.balance ?? 0)
    }
    return out
  }

  return { me, groups, groupMap, expenses, settlements, personal, users, myExpenses, inRange, myBalances }
}
