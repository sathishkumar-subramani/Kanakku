import { Router } from 'express'
import { ApiError } from '../lib/errors.js'
import { ensureObjectId, money, monthRange, oid, parseDay, round2, sameId } from '../lib/util.js'
import { body, query, schemas } from '../lib/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { Expense, Group } from '../models/index.js'
import { computeSplits } from '../services/calculators.js'
import { isMember, logActivity, memberIds, myGroups, requireMember, requireUser, usersById } from '../services/data.js'
import { expenseDto } from '../services/mappers.js'

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const allUserIds = (e) => [e.paidBy, ...e.splits.map((s) => s.userId)]

/** Validates paidBy/splits against the group (people who have since left may stay on an old expense being edited). */
function checkPeople(input, group, existing) {
  const allowed = new Set(memberIds(group))
  if (existing) {
    allowed.add(String(existing.paidBy))
    for (const s of existing.splits) allowed.add(String(s.userId))
  }
  if (!allowed.has(input.paidBy)) throw ApiError.badRequest('The person who paid must be a member of the group.', 'paidBy')
  for (const s of input.splits) if (!allowed.has(s.userId)) throw ApiError.badRequest('Everyone in the split must be a member of the group.', 'splits')
}

function fieldsFrom(input, group) {
  return {
    description: input.description,
    amount: round2(input.amount),
    currency: group.currency,
    category: input.category,
    date: parseDay(input.date),
    notes: input.notes || null,
    paidBy: oid(input.paidBy),
    splitType: input.splitType,
    splits: computeSplits(input.amount, input.splitType, input.paidBy, input.splits).map((s) => ({ ...s, userId: oid(s.userId) })),
  }
}

async function loadExpense(expenseId, userId) {
  const id = ensureObjectId(expenseId, 'Expense')
  const expense = await Expense.findById(id).lean()
  if (!expense) throw ApiError.notFound('Expense')
  const group = await requireMember(String(expense.groupId), userId)
  return { expense, group }
}

// ---------- /api/groups/:id/expenses ----------

export const groupExpensesRouter = Router({ mergeParams: true })
groupExpensesRouter.use(requireAuth)

groupExpensesRouter.get('/', query(schemas.expenseQuery), async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  const { month, category, search, page, pageSize } = req.q
  const filter = { groupId: group._id }
  if (month) {
    const { start, end } = monthRange(month)
    filter.date = { $gte: start, $lt: end }
  }
  if (category) filter.category = category.trim().toLowerCase()
  if (search?.trim()) filter.description = { $regex: escapeRegex(search.trim()), $options: 'i' }

  const [total, items] = await Promise.all([
    Expense.countDocuments(filter),
    Expense.find(filter).sort({ date: -1, createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
  ])
  const users = await usersById([...memberIds(group), ...items.flatMap(allUserIds)])
  res.json({ items: items.map((e) => expenseDto(e, group, users, req.userId)), total, page, pageSize })
})

groupExpensesRouter.post('/', body(schemas.expense), async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  checkPeople(req.body, group)
  const actor = await requireUser(req.userId)
  const now = new Date()
  const expense = (await Expense.create({ groupId: group._id, ...fieldsFrom(req.body, group), createdBy: actor._id, createdAt: now, updatedAt: now })).toObject()
  await logActivity(group._id, actor, 'expense.added', `${actor.name} added "${expense.description}" for ${money(expense.amount, group.currency)}`, expense._id)
  const users = await usersById(memberIds(group))
  res.status(201).json(expenseDto(expense, group, users, req.userId))
})

// ---------- /api/expenses ----------

export const expensesRouter = Router()
expensesRouter.use(requireAuth)

expensesRouter.get('/recent', query(schemas.limitQuery.extend({ limit: schemas.limitQuery.shape.limit.default(20) })), async (req, res) => {
  const groups = await myGroups(req.userId)
  if (groups.length === 0) return res.json([])
  const groupMap = new Map(groups.map((g) => [String(g._id), g]))
  const me = oid(req.userId)
  const items = await Expense.find({
    groupId: { $in: groups.map((g) => g._id) },
    $or: [{ paidBy: me }, { 'splits.userId': me }],
  })
    .sort({ date: -1, createdAt: -1, _id: -1 })
    .limit(Math.min(req.q.limit, 100))
    .lean()
  const users = await usersById(items.flatMap(allUserIds))
  res.json(items.map((e) => expenseDto(e, groupMap.get(String(e.groupId)), users, req.userId)))
})

expensesRouter.get('/:id', async (req, res) => {
  const { expense, group } = await loadExpense(req.params.id, req.userId)
  const users = await usersById([...memberIds(group), ...allUserIds(expense)])
  res.json(expenseDto(expense, group, users, req.userId))
})

expensesRouter.put('/:id', body(schemas.expense), async (req, res) => {
  const { expense, group } = await loadExpense(req.params.id, req.userId)
  checkPeople(req.body, group, expense)
  const actor = await requireUser(req.userId)
  const fields = { ...fieldsFrom(req.body, group), updatedAt: new Date() }
  await Expense.updateOne({ _id: expense._id }, { $set: fields })
  const updated = { ...expense, ...fields }
  await logActivity(group._id, actor, 'expense.updated', `${actor.name} updated "${updated.description}" (${money(updated.amount, group.currency)})`, expense._id)
  const users = await usersById([...memberIds(group), ...allUserIds(updated)])
  res.json(expenseDto(updated, group, users, req.userId))
})

expensesRouter.delete('/:id', async (req, res) => {
  const { expense, group } = await loadExpense(req.params.id, req.userId)
  const actor = await requireUser(req.userId)
  await Expense.deleteOne({ _id: expense._id })
  await logActivity(group._id, actor, 'expense.deleted', `${actor.name} deleted "${expense.description}" (${money(expense.amount, group.currency)})`, expense._id)
  res.status(204).end()
})

export { Group, isMember, sameId }
