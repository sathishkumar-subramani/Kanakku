import { Router } from 'express'
import { ApiError } from '../lib/errors.js'
import { ensureObjectId, isZero, money, monthRange, newInviteCode, oid, sameId } from '../lib/util.js'
import { body, query, schemas } from '../lib/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { Activity, Expense, Group, Settlement, User } from '../models/index.js'
import { groupDebts, memberTotals } from '../services/calculators.js'
import { expensesOf, groupToDto, isOwner, logActivity, memberIds, myGroups, requireMember, requireUser, settlementsOf, usersById } from '../services/data.js'
import { activityDto, groupDto, person } from '../services/mappers.js'

export const groupsRouter = Router()
groupsRouter.use(requireAuth)

// ---------- list / create / join ----------

groupsRouter.get('/', query(schemas.monthQuery), async (req, res) => {
  const groups = await myGroups(req.userId)
  if (groups.length === 0) return res.json([])
  const ids = groups.map((g) => String(g._id))
  const [expenses, settlements, users] = await Promise.all([expensesOf(ids), settlementsOf(ids), usersById(groups.flatMap(memberIds))])
  const range = monthRange(req.q.month)
  const dtos = groups
    .map((g) =>
      groupDto(
        g,
        users,
        expenses.filter((e) => sameId(e.groupId, g._id)),
        settlements.filter((s) => sameId(s.groupId, g._id)),
        req.userId,
        range,
      ),
    )
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
  res.json(dtos)
})

groupsRouter.post('/', body(schemas.createGroup), async (req, res) => {
  const actor = await requireUser(req.userId)
  const now = new Date()
  let group
  for (let attempt = 0; ; attempt++) {
    try {
      group = await Group.create({
        name: req.body.name,
        emoji: req.body.emoji || '🏠',
        color: req.body.color || '#E2590B',
        currency: req.body.currency || actor.currency || 'INR',
        inviteCode: newInviteCode(),
        simplifyDebts: true,
        createdBy: actor._id,
        createdAt: now,
        members: [{ userId: actor._id, role: 'owner', joinedAt: now }],
      })
      break
    } catch (err) {
      if (err?.code === 11000 && attempt < 5) continue // invite code collision (astronomically rare)
      throw err
    }
  }
  await logActivity(group._id, actor, 'group.created', `${actor.name} created the group`)
  res.status(201).json(await groupToDto(group.toObject(), req.userId))
})

groupsRouter.post('/join', body(schemas.join), async (req, res) => {
  const code = req.body.inviteCode.toUpperCase().replace(/[\s-]/g, '')
  const group = await Group.findOne({ inviteCode: code }).lean()
  if (!group) throw new ApiError(404, "That invite code didn't match any group.")
  if (!group.members.some((m) => sameId(m.userId, req.userId))) {
    const actor = await requireUser(req.userId)
    await addMember(group, actor, actor)
  }
  res.json(await groupToDto((await Group.findById(group._id).lean()) ?? group, req.userId))
})

async function addMember(group, newMember, actor) {
  const member = { userId: newMember._id, role: 'member', joinedAt: new Date() }
  // Atomic + idempotent: the $ne guard means a concurrent double-add inserts the member once.
  const result = await Group.updateOne({ _id: group._id, 'members.userId': { $ne: newMember._id } }, { $push: { members: member } })
  if (result.matchedCount === 0) return
  const msg = sameId(actor._id, newMember._id) ? `${newMember.name} joined the group` : `${actor.name} added ${newMember.name}`
  await logActivity(group._id, actor, 'member.joined', msg, newMember._id)
}

// ---------- one group ----------

groupsRouter.get('/:id', query(schemas.monthQuery), async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  res.json(await groupToDto(group, req.userId, req.q.month))
})

groupsRouter.put('/:id', body(schemas.updateGroup), async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  if (!isOwner(group, req.userId)) throw ApiError.forbidden('Only the group owner can change group settings.')
  const actor = await requireUser(req.userId)

  const set = {}
  const changes = []
  if (req.body.name !== undefined && req.body.name !== group.name) (set.name = req.body.name), changes.push('name')
  if (req.body.emoji !== undefined && req.body.emoji !== group.emoji) (set.emoji = req.body.emoji), changes.push('emoji')
  if (req.body.color !== undefined && req.body.color !== group.color) (set.color = req.body.color), changes.push('colour')
  if (req.body.simplifyDebts !== undefined && req.body.simplifyDebts !== group.simplifyDebts) {
    set.simplifyDebts = req.body.simplifyDebts
    changes.push(req.body.simplifyDebts ? 'turned on simplify debts' : 'turned off simplify debts')
  }
  if (changes.length) {
    await Group.updateOne({ _id: group._id }, { $set: set })
    await logActivity(group._id, actor, 'group.updated', `${actor.name} updated the group (${changes.join(', ')})`)
  }
  res.json(await groupToDto(await Group.findById(group._id).lean(), req.userId))
})

groupsRouter.delete('/:id', async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  if (!isOwner(group, req.userId)) throw ApiError.forbidden('Only the group owner can delete the group.')
  await deleteGroupData(group._id)
  res.status(204).end()
})

async function deleteGroupData(groupId) {
  await Promise.all([
    Expense.deleteMany({ groupId }),
    Settlement.deleteMany({ groupId }),
    Activity.deleteMany({ groupId }),
  ])
  await Group.deleteOne({ _id: groupId })
}

groupsRouter.post('/:id/invite/regenerate', async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  if (!isOwner(group, req.userId)) throw ApiError.forbidden('Only the group owner can change the invite code.')
  for (let attempt = 0; ; attempt++) {
    const inviteCode = newInviteCode()
    try {
      await Group.updateOne({ _id: group._id }, { $set: { inviteCode } })
      return res.json({ inviteCode })
    } catch (err) {
      if (err?.code === 11000 && attempt < 5) continue
      throw err
    }
  }
})

// ---------- members ----------

groupsRouter.post('/:id/members', body(schemas.addMember), async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  const actor = await requireUser(req.userId)
  const user = await User.findOne({ email: req.body.email }).lean()
  if (!user) throw new ApiError(404, 'No Kanakku account with that email. Ask them to sign up first, or share the invite code.')
  if (group.members.some((m) => sameId(m.userId, user._id))) throw ApiError.conflict(`${user.name} is already in this group.`)
  await addMember(group, user, actor)
  res.json(await groupToDto(await Group.findById(group._id).lean(), req.userId))
})

groupsRouter.delete('/:id/members/:userId', async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  const target = ensureObjectId(req.params.userId, 'Member')
  const leaving = sameId(target, req.userId)
  if (!leaving && !isOwner(group, req.userId)) throw ApiError.forbidden('Only the group owner can remove other members.')
  if (!group.members.some((m) => sameId(m.userId, target))) throw ApiError.notFound('Member')

  const [expenses, settlements, users] = await Promise.all([
    Expense.find({ groupId: group._id }).lean(),
    Settlement.find({ groupId: group._id }).lean(),
    usersById([String(target), req.userId]),
  ])
  const balance = memberTotals(memberIds(group), expenses, settlements).get(String(target))?.balance ?? 0
  const who = person(target, users).name
  if (!isZero(balance)) {
    const text =
      balance < 0
        ? `${leaving ? 'You' : who} still owe${leaving ? '' : 's'} ${money(-balance, group.currency)} in this group. Settle up first.`
        : `${leaving ? 'You are' : who + ' is'} still owed ${money(balance, group.currency)} in this group. Settle up first.`
    throw ApiError.conflict(text)
  }

  const actor = users.get(req.userId)
  if (group.members.length === 1) {
    // Sole member leaving: the group goes with them.
    await deleteGroupData(group._id)
    return res.status(204).end()
  }

  // Atomic $pull so a concurrent join is never lost; then hand ownership to the longest-standing member if needed.
  await Group.updateOne({ _id: group._id }, { $pull: { members: { userId: target } } })
  const remaining = group.members.filter((m) => !sameId(m.userId, target))
  if (!remaining.some((m) => m.role === 'owner')) {
    const heir = [...remaining].sort((a, b) => a.joinedAt - b.joinedAt)[0]
    await Group.updateOne({ _id: group._id }, { $set: { 'members.$[m].role': 'owner' } }, { arrayFilters: [{ 'm.userId': heir.userId }] })
  }
  await logActivity(group._id, actor, 'member.left', leaving ? `${actor.name} left the group` : `${actor.name} removed ${who}`, target)
  res.status(204).end()
})

// ---------- balances & activity ----------

groupsRouter.get('/:id/balances', async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  const [expenses, settlements] = await Promise.all([Expense.find({ groupId: group._id }).lean(), Settlement.find({ groupId: group._id }).lean()])
  const totals = memberTotals(memberIds(group), expenses, settlements)
  const users = await usersById([...totals.keys()])

  const members = [...group.members]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((m) => {
      const p = person(m.userId, users)
      const t = totals.get(String(m.userId))
      return { userId: p.id, name: p.name, avatarColor: p.avatarColor, balance: t.balance, paid: t.paid, share: t.share }
    })

  const debts = groupDebts(group, expenses, settlements, totals).map((d) => {
    const from = person(d.fromUserId, users)
    const to = person(d.toUserId, users)
    return { fromUserId: from.id, fromName: from.name, toUserId: to.id, toName: to.name, amount: d.amount }
  })

  res.json({ simplified: group.simplifyDebts, members, debts })
})

groupsRouter.get('/:id/activity', query(schemas.limitQuery), async (req, res) => {
  const group = await requireMember(req.params.id, req.userId)
  const items = await Activity.find({ groupId: group._id }).sort({ createdAt: -1, _id: -1 }).limit(req.q.limit).lean()
  res.json(items.map(activityDto))
})

export { oid }
