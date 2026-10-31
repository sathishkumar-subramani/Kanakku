import { Router } from 'express'
import { ApiError } from '../lib/errors.js'
import { ensureObjectId, oid } from '../lib/util.js'
import { body, schemas } from '../lib/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { CaptureRule, Expense, PersonalExpense, Settlement, SmsTemplate } from '../models/index.js'
import { isMember, myGroups, requireMember } from '../services/data.js'

/**
 * Support for the phone's payment inbox. Raw SMS / notifications never come here — the phone parses
 * them locally and only sends (a) capture keys to check, (b) the user's own filing rules and
 * (c) anonymous "teach once" format hints.
 */
export const captureRouter = Router()
captureRouter.use(requireAuth)

// ---------- which captured payments are already recorded? ----------

captureRouter.post('/match', body(schemas.captureMatch), async (req, res) => {
  const keys = [...new Set(req.body.keys)]
  const recorded = {}
  if (keys.length) {
    const groups = await myGroups(req.userId)
    const groupIds = groups.map((g) => g._id)
    const [personal, expenses, settlements] = await Promise.all([
      PersonalExpense.find({ userId: oid(req.userId), sourceRef: { $in: keys } }, { sourceRef: 1 }).lean(),
      groupIds.length ? Expense.find({ groupId: { $in: groupIds }, sourceRef: { $in: keys } }, { sourceRef: 1, groupId: 1 }).lean() : [],
      groupIds.length ? Settlement.find({ groupId: { $in: groupIds }, sourceRef: { $in: keys } }, { sourceRef: 1, groupId: 1 }).lean() : [],
    ])
    for (const p of personal) recorded[p.sourceRef] = { kind: 'personal', id: String(p._id), groupId: null }
    for (const e of expenses) recorded[e.sourceRef] = { kind: 'expense', id: String(e._id), groupId: String(e.groupId) }
    for (const s of settlements) recorded[s.sourceRef] = { kind: 'settlement', id: String(s._id), groupId: String(s.groupId) }
  }
  res.json({ recorded })
})

// ---------- filing rules ("Annachi Store → Room 302, split with everyone") ----------

const ruleDto = (r) => ({
  id: String(r._id),
  key: r.key,
  label: r.label ?? '',
  kind: r.kind,
  groupId: r.groupId ? String(r.groupId) : null,
  category: r.category ?? null,
  description: r.description ?? null,
  splitWith: (r.splitWith ?? []).map(String),
  counterpartyUserId: r.counterpartyUserId ? String(r.counterpartyUserId) : null,
  autoSave: !!r.autoSave,
  updatedAt: r.updatedAt,
})

captureRouter.get('/rules', async (req, res) => {
  const rules = await CaptureRule.find({ userId: oid(req.userId) }).sort({ updatedAt: -1, _id: -1 }).lean()
  res.json(rules.map(ruleDto))
})

captureRouter.put('/rules', body(schemas.captureRule), async (req, res) => {
  const input = req.body
  let group = null
  if (input.kind === 'group' || input.kind === 'settlement') {
    if (!input.groupId) throw ApiError.badRequest('Pick a group for this rule.', 'groupId')
    group = await requireMember(input.groupId, req.userId)
    for (const u of input.splitWith) if (!isMember(group, u)) throw ApiError.badRequest('Everyone in the split must be a member of the group.', 'splitWith')
    if (input.kind === 'settlement') {
      if (!input.counterpartyUserId || !isMember(group, input.counterpartyUserId) || input.counterpartyUserId === req.userId)
        throw ApiError.badRequest('Pick the roommate on the other side of this payment.', 'counterpartyUserId')
    }
  }
  const now = new Date()
  const fields = {
    label: input.label,
    kind: input.kind,
    groupId: group ? group._id : null,
    category: input.kind === 'personal' || input.kind === 'group' ? (input.category ?? null) : null,
    description: input.kind === 'personal' || input.kind === 'group' ? input.description || null : null,
    splitWith: input.kind === 'group' ? input.splitWith.map(oid) : [],
    counterpartyUserId: input.kind === 'settlement' ? oid(input.counterpartyUserId) : null,
    autoSave: input.kind === 'ignore' ? false : input.autoSave,
    updatedAt: now,
  }
  const rule = await CaptureRule.findOneAndUpdate(
    { userId: oid(req.userId), key: input.key },
    { $set: fields, $setOnInsert: { createdAt: now } },
    { upsert: true, returnDocument: 'after' },
  ).lean()
  res.json(ruleDto(rule))
})

captureRouter.delete('/rules/:id', async (req, res) => {
  const id = ensureObjectId(req.params.id, 'Rule')
  const r = await CaptureRule.deleteOne({ _id: id, userId: oid(req.userId) })
  if (r.deletedCount === 0) throw ApiError.notFound('Rule')
  res.status(204).end()
})

// ---------- shared "teach once" SMS format hints ----------

const templateDto = (t) => ({
  senderKey: t.senderKey,
  direction: t.direction,
  amountBefore: t.amountBefore,
  payeeBefore: t.payeeBefore ?? undefined,
  payeeAfter: t.payeeAfter ?? undefined,
  uses: t.uses ?? 1,
})

captureRouter.get('/templates', async (_req, res) => {
  const items = await SmsTemplate.find({}).sort({ uses: -1, _id: 1 }).limit(500).lean()
  res.json(items.map(templateDto))
})

captureRouter.post('/templates', body(schemas.smsTemplate), async (req, res) => {
  const t = req.body
  const now = new Date()
  const doc = await SmsTemplate.findOneAndUpdate(
    { senderKey: t.senderKey, direction: t.direction, amountBefore: t.amountBefore, payeeBefore: t.payeeBefore ?? null, payeeAfter: t.payeeAfter ?? null },
    { $inc: { uses: 1 }, $set: { updatedAt: now }, $setOnInsert: { createdBy: oid(req.userId), createdAt: now } },
    { upsert: true, returnDocument: 'after' },
  ).lean()
  res.status(201).json(templateDto(doc))
})
