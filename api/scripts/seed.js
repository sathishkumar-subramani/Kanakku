/**
 * Seeds a demo room so you can click around immediately.
 *   npm run seed            (uses MONGODB_URI / MONGODB_DB from .env)
 * Accounts (password for all: demo1234):
 *   sathish@demo.kanakku · arun@demo.kanakku · priya@demo.kanakku · karthik@demo.kanakku
 */
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDb, disconnectDb } from '../src/db.js'
import { computeSplits } from '../src/services/calculators.js'
import { Activity, Expense, Group, PersonalExpense, RefreshToken, Settlement, User } from '../src/models/index.js'
import { avatarColorFor, newInviteCode, round2 } from '../src/lib/util.js'

const PASSWORD = 'demo1234'
const people = [
  ['Sathish Kumar', 'sathish@demo.kanakku'],
  ['Arun', 'arun@demo.kanakku'],
  ['Priya', 'priya@demo.kanakku'],
  ['Karthik', 'karthik@demo.kanakku'],
]

const now = new Date()
const ym = (offsetMonths, day) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offsetMonths, day))

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
  console.error('Refusing to seed in production. Set ALLOW_SEED=true if you really mean it.')
  process.exit(1)
}

await connectDb()
const hash = await bcrypt.hash(PASSWORD, 10)

// wipe previous demo data
const existing = await User.find({ email: { $in: people.map((p) => p[1]) } }).lean()
if (existing.length) {
  const ids = existing.map((u) => u._id)
  // Only groups the demo users created — never a real user's group that happened to invite a demo account.
  const groups = await Group.find({ createdBy: { $in: ids } }).lean()
  const gids = groups.map((g) => g._id)
  await Promise.all([
    Expense.deleteMany({ groupId: { $in: gids } }),
    Settlement.deleteMany({ groupId: { $in: gids } }),
    Activity.deleteMany({ groupId: { $in: gids } }),
    Group.deleteMany({ _id: { $in: gids } }),
    PersonalExpense.deleteMany({ userId: { $in: ids } }),
    User.deleteMany({ _id: { $in: ids } }),
    RefreshToken.deleteMany({ userId: { $in: ids } }),
  ])
}

const users = await User.insertMany(people.map(([name, email]) => ({ name, email, passwordHash: hash, currency: 'INR', avatarColor: avatarColorFor(email) })))
const [me, arun, priya, karthik] = users
const all = users.map((u) => u._id)

const room = await Group.create({
  name: 'Room 302',
  emoji: '🏠',
  color: '#E2590B',
  currency: 'INR',
  inviteCode: newInviteCode(),
  createdBy: me._id,
  createdAt: ym(2, 1),
  members: users.map((u, i) => ({ userId: u._id, role: i === 0 ? 'owner' : 'member', joinedAt: ym(2, 1 + i) })),
})
const trip = await Group.create({
  name: 'Goa trip',
  emoji: '✈️',
  color: '#2BB3C9',
  currency: 'INR',
  inviteCode: newInviteCode(),
  createdBy: arun._id,
  createdAt: ym(1, 10),
  members: [arun, me, priya].map((u, i) => ({ userId: u._id, role: i === 0 ? 'owner' : 'member', joinedAt: ym(1, 10) })),
})

const equal = (ids) => ids.map((userId) => ({ userId }))
const exp = (group, paidBy, description, amount, category, date, splitType = 'equal', splits = equal(all)) => ({
  groupId: group._id,
  description,
  amount: round2(amount),
  currency: 'INR',
  category,
  date,
  paidBy: paidBy._id,
  splitType,
  splits: computeSplits(amount, splitType, String(paidBy._id), splits.map((s) => ({ userId: String(s.userId), value: s.value ?? 0 }))).map((s) => ({ ...s, userId: new mongoose.Types.ObjectId(s.userId) })),
  createdBy: paidBy._id,
  createdAt: date,
  updatedAt: date,
})

const monthly = (m) => [
  exp(room, me, 'Rent', 18000, 'rent', ym(m, 1)),
  exp(room, arun, 'Electricity bill', 1240, 'utilities', ym(m, 5)),
  exp(room, priya, 'Groceries — weekly', 1480, 'groceries', ym(m, 3)),
  exp(room, karthik, 'Groceries — weekly', 1620, 'groceries', ym(m, 10)),
  exp(room, me, 'Wi-Fi', 999, 'utilities', ym(m, 7)),
  exp(room, arun, 'Dinner — Saravana Bhavan', 860, 'food', ym(m, 12)),
  exp(room, priya, 'Cleaning supplies', 430, 'household', ym(m, 14)),
  exp(room, me, 'Gas cylinder', 1105, 'household', ym(m, 16), 'equal', equal(all)),
  exp(room, karthik, 'Movie night', 1200, 'entertainment', ym(m, 18), 'exact', [
    { userId: me._id, value: 300 },
    { userId: arun._id, value: 300 },
    { userId: karthik._id, value: 600 },
  ]),
  exp(room, arun, 'Sunday biryani', 1500, 'food', ym(m, 21), 'shares', [
    { userId: me._id, value: 1 },
    { userId: arun._id, value: 2 },
    { userId: priya._id, value: 1 },
    { userId: karthik._id, value: 1 },
  ]),
]

await Expense.insertMany([
  ...monthly(2),
  ...monthly(1),
  ...monthly(0).filter((e) => e.date <= now),
  exp(trip, arun, 'Train tickets', 4800, 'travel', ym(1, 15), 'equal', equal([arun._id, me._id, priya._id])),
  exp(trip, me, 'Hotel', 7500, 'travel', ym(1, 16), 'equal', equal([arun._id, me._id, priya._id])),
  exp(trip, priya, 'Beach shack dinner', 2100, 'food', ym(1, 16), 'equal', equal([arun._id, me._id, priya._id])),
  exp(trip, me, 'Scooter rental', 1200, 'travel', ym(1, 17), 'percent', [
    { userId: arun._id, value: 50 },
    { userId: me._id, value: 50 },
  ]),
])

await Settlement.insertMany([
  { groupId: room._id, fromUserId: priya._id, toUserId: me._id, amount: 4000, date: ym(2, 28), note: 'GPay', createdBy: priya._id, createdAt: ym(2, 28) },
  { groupId: room._id, fromUserId: karthik._id, toUserId: me._id, amount: 3500, date: ym(1, 2), note: 'cash', createdBy: karthik._id, createdAt: ym(1, 2) },
  { groupId: room._id, fromUserId: arun._id, toUserId: me._id, amount: 3000, date: ym(1, 3), note: null, createdBy: arun._id, createdAt: ym(1, 3) },
  { groupId: trip._id, fromUserId: priya._id, toUserId: me._id, amount: 2000, date: ym(1, 20), note: 'part payment', createdBy: priya._id, createdAt: ym(1, 20) },
])

const personal = []
for (let m = 2; m >= 0; m--) {
  const items = [
    ['Filter coffee', 40, 'food', 2],
    ['Auto to office', 120, 'travel', 4],
    ['Mobile recharge', 299, 'utilities', 6],
    ['Lunch', 180, 'food', 9],
    ['T-shirt', 799, 'shopping', 13],
    ['Pharmacy', 260, 'health', 19],
    ['Book', 450, 'shopping', 24],
    ['Juice', 60, 'food', 27],
  ]
  for (const [description, amount, category, d] of items) {
    const date = ym(m, d)
    if (date <= now) personal.push({ userId: me._id, description, amount, category, date, notes: null, createdAt: date, updatedAt: date })
  }
}
await PersonalExpense.insertMany(personal)

await Activity.insertMany([
  { groupId: room._id, actorId: me._id, actorName: me.name, type: 'group.created', message: `${me.name} created the group`, createdAt: ym(2, 1) },
  ...[arun, priya, karthik].map((u, i) => ({ groupId: room._id, actorId: u._id, actorName: u.name, type: 'member.joined', message: `${u.name} joined the group`, refId: String(u._id), createdAt: ym(2, 2 + i) })),
  { groupId: trip._id, actorId: arun._id, actorName: arun.name, type: 'group.created', message: `${arun.name} created the group`, createdAt: ym(1, 10) },
])

console.log(`
Seeded demo data.
  Sign in with any of: ${people.map((p) => p[1]).join(', ')}
  Password: ${PASSWORD}
  Room 302 invite code: ${room.inviteCode}   Goa trip invite code: ${trip.inviteCode}
`)
await disconnectDb()
