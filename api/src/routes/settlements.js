import { Router } from 'express'
import { ApiError } from '../lib/errors.js'
import { ensureObjectId, money, monthRange, oid, parseDay, round2, sameId } from '../lib/util.js'
import { body, query, schemas } from '../lib/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { PersonalExpense, Settlement } from '../models/index.js'
import { isMember, logActivity, requireMember, requireUser, usersById } from '../services/data.js'
import { person, personalDto, settlementDto } from '../services/mappers.js'

// ---------- /api/groups/:id/settlements ----------

export const groupSettlementsRouter = Router({ mergeParams: true })
groupSettlementsRouter.use(requireAuth)

groupSettlementsRouter.get('/', async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  const items = await Settlement.find({ groupId: group._id }).sort({ date: -1, createdAt: -1, _id: -1 }).lean()
  const users = await usersById(items.flatMap((s) => [s.fromUserId, s.toUserId]))
  res.json(items.map((s) => settlementDto(s, users)))
})

groupSettlementsRouter.post('/', body(schemas.settlement), async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  const { fromUserId, toUserId } = req.body
  if (fromUserId === toUserId) throw ApiError.badRequest('Payer and receiver must be different people.', 'toUserId')
  if (!isMember(group, fromUserId) || !isMember(group, toUserId)) throw ApiError.badRequest('Both people must be members of the group.', 'fromUserId')
  const actor = await requireUser(req.userId)

  const settlement = (
    await Settlement.create({
      groupId: group._id,
      fromUserId: oid(fromUserId),
      toUserId: oid(toUserId),
      amount: round2(req.body.amount),
      date: parseDay(req.body.date),
      note: req.body.note || null,
      createdBy: actor._id,
      createdAt: new Date(),
    })
  ).toObject()

  const users = await usersById([fromUserId, toUserId])
  await logActivity(group._id, actor, 'settlement.added', `${person(fromUserId, users).name} paid ${person(toUserId, users).name} ${money(settlement.amount, group.currency)}`, settlement._id)
  res.status(201).json(settlementDto(settlement, users))
})

// ---------- /api/settlements ----------

export const settlementsRouter = Router()
settlementsRouter.use(requireAuth)

settlementsRouter.delete('/:id', async (req, res) => {
  const id = ensureObjectId(req.params.id, 'Payment')
  const settlement = await Settlement.findById(id).lean()
  if (!settlement) throw ApiError.notFound('Payment')
  const group = await requireMember(String(settlement.groupId), req.userId)
  const actor = await requireUser(req.userId)
  await Settlement.deleteOne({ _id: settlement._id })
  const users = await usersById([settlement.fromUserId, settlement.toUserId])
  await logActivity(
    group._id,
    actor,
    'settlement.deleted',
    `${actor.name} removed the payment ${person(settlement.fromUserId, users).name} → ${person(settlement.toUserId, users).name} (${money(settlement.amount, group.currency)})`,
    settlement._id,
  )
  res.status(204).end()
})

// ---------- /api/personal ----------

export const personalRouter = Router()
personalRouter.use(requireAuth)

personalRouter.get('/', query(schemas.monthQuery), async (req, res) => {
  const filter = { userId: oid(req.userId) }
  if (req.q.month) {
    const { start, end } = monthRange(req.q.month)
    filter.date = { $gte: start, $lt: end }
  }
  const items = await PersonalExpense.find(filter).sort({ date: -1, createdAt: -1, _id: -1 }).lean()
  res.json(items.map(personalDto))
})

const personalFields = (input) => ({
  description: input.description,
  amount: round2(input.amount),
  category: input.category,
  date: parseDay(input.date),
  notes: input.notes || null,
})

personalRouter.post('/', body(schemas.personal), async (req, res) => {
  const now = new Date()
  const p = await PersonalExpense.create({ userId: oid(req.userId), ...personalFields(req.body), createdAt: now, updatedAt: now })
  res.status(201).json(personalDto(p.toObject()))
})

async function loadPersonal(id, userId) {
  const _id = ensureObjectId(id, 'Expense')
  const p = await PersonalExpense.findOne({ _id, userId: oid(userId) }).lean()
  if (!p) throw ApiError.notFound('Expense')
  return p
}

personalRouter.put('/:id', body(schemas.personal), async (req, res) => {
  const p = await loadPersonal(req.params.id, req.userId)
  const fields = { ...personalFields(req.body), updatedAt: new Date() }
  await PersonalExpense.updateOne({ _id: p._id }, { $set: fields })
  res.json(personalDto({ ...p, ...fields }))
})

personalRouter.delete('/:id', async (req, res) => {
  const p = await loadPersonal(req.params.id, req.userId)
  await PersonalExpense.deleteOne({ _id: p._id })
  res.status(204).end()
})

export { sameId }
