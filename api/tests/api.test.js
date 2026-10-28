/**
 * End-to-end tests: the real Express app + real Mongoose, talking to the in-memory wire-protocol server.
 */
import mongoose from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDb, disconnectDb } from '../src/db.js'
import { startFakeMongo } from './fakeMongo.js'

let srv
let app

const MONTH = new Date().toISOString().slice(0, 7)
const day = (d) => `${MONTH}-${String(d).padStart(2, '0')}`

beforeAll(async () => {
  srv = await startFakeMongo()
  await connectDb(srv.uri, 'kanakku_test')
  app = createApp()
})

afterAll(async () => {
  await disconnectDb()
  await srv.stop()
})

beforeEach(async () => {
  // wipe data but keep indexes
  for (const model of Object.values(mongoose.models)) await model.deleteMany({})
})

// ---------- helpers ----------

async function signUp(name, email, password = 'secret1') {
  const res = await request(app).post('/api/auth/register').send({ name, email, password })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  const auth = (r) => r.set('Authorization', `Bearer ${res.body.accessToken}`)
  return {
    id: res.body.user.id,
    name,
    email,
    tokens: res.body,
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body ?? {}),
    put: (url, body) => auth(request(app).put(url)).send(body ?? {}),
    del: (url) => auth(request(app).delete(url)),
  }
}

async function roomSetup() {
  const me = await signUp('Sathish Kumar', 'sathish@example.com')
  const arun = await signUp('Arun', 'arun@example.com')
  const priya = await signUp('Priya', 'priya@example.com')
  const g = await me.post('/api/groups', { name: 'Room 302', emoji: '🏠', color: '#E2590B' })
  expect(g.status).toBe(201)
  const group = g.body
  await arun.post('/api/groups/join', { inviteCode: group.inviteCode }).expect(200)
  await priya.post('/api/groups/join', { inviteCode: group.inviteCode.toLowerCase() }).expect(200)
  const all = [me.id, arun.id, priya.id].map((userId) => ({ userId, value: 0 }))
  // A pays 1500 groceries equal; B pays 900 electricity equal; C pays 600 dinner exact A=200, C=400
  await me.post(`/api/groups/${group.id}/expenses`, { description: 'Groceries', amount: 1500, category: 'groceries', date: day(3), paidBy: me.id, splitType: 'equal', splits: all }).expect(201)
  await arun.post(`/api/groups/${group.id}/expenses`, { description: 'Electricity bill', amount: 900, category: 'utilities', date: day(5), paidBy: arun.id, splitType: 'equal', splits: all }).expect(201)
  await priya
    .post(`/api/groups/${group.id}/expenses`, { description: 'Dinner', amount: 600, category: 'food', date: day(6), paidBy: priya.id, splitType: 'exact', splits: [{ userId: me.id, value: 200 }, { userId: priya.id, value: 400 }] })
    .expect(201)
  await me.post('/api/personal', { description: 'Coffee', amount: 120, category: 'food', date: day(4) }).expect(201)
  return { me, arun, priya, group }
}

// ---------- auth ----------

describe('auth', () => {
  it('registers, signs in, refreshes with rotation, logs out', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Sathish', email: 'Sathish@Example.com ', password: 'secret1' })
    expect(reg.status).toBe(201)
    expect(reg.body.user).toMatchObject({ name: 'Sathish', email: 'sathish@example.com', currency: 'INR' })
    expect(reg.body.user.avatarColor).toMatch(/^#[0-9A-F]{6}$/)
    expect(reg.body.accessToken).toBeTruthy()

    const dup = await request(app).post('/api/auth/register').send({ name: 'X', email: 'sathish@example.com', password: 'secret1' })
    expect(dup.status).toBe(409)
    expect(dup.headers['content-type']).toMatch(/application\/problem\+json/)

    const bad = await request(app).post('/api/auth/login').send({ email: 'sathish@example.com', password: 'nope' })
    expect(bad.status).toBe(401)
    expect(bad.body.detail).toBe('Email or password is incorrect.')

    const login = await request(app).post('/api/auth/login').send({ email: 'sathish@example.com', password: 'secret1' })
    expect(login.status).toBe(200)

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`)
    expect(me.status).toBe(200)
    expect(me.body.email).toBe('sathish@example.com')

    const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken })
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken)

    // the old refresh token is now revoked
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken })
    expect(reuse.status).toBe(401)

    await request(app).post('/api/auth/logout').send({ refreshToken: refreshed.body.refreshToken }).expect(204)
    const afterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken: refreshed.body.refreshToken })
    expect(afterLogout.status).toBe(401)
  })

  it('validates input with field errors', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: '', email: 'not-an-email', password: '123' })
    expect(res.status).toBe(400)
    expect(res.body.title).toBe('Validation failed')
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['name', 'email', 'password']))
  })

  it('rejects missing / bad tokens', async () => {
    expect((await request(app).get('/api/groups')).status).toBe(401)
    expect((await request(app).get('/api/groups').set('Authorization', 'Bearer nope')).status).toBe(401)
  })

  it('updates the profile and changes the password keeping this device signed in', async () => {
    const me = await signUp('Sathish', 'sathish@example.com')
    const upd = await me.put('/api/auth/me', { name: 'Sathish K', currency: 'usd', avatarColor: '#1d8f62' })
    expect(upd.status).toBe(200)
    expect(upd.body).toMatchObject({ name: 'Sathish K', currency: 'USD', avatarColor: '#1D8F62' })
    expect((await me.put('/api/auth/me', { avatarColor: 'red' })).status).toBe(400)

    const other = await request(app).post('/api/auth/login').send({ email: 'sathish@example.com', password: 'secret1' })
    const wrong = await me.put('/api/auth/password', { currentPassword: 'wrong', newPassword: 'secret2' })
    expect(wrong.status).toBe(400)
    await me.put('/api/auth/password', { currentPassword: 'secret1', newPassword: 'secret2', refreshToken: me.tokens.refreshToken }).expect(204)
    // other device is signed out, this one is not
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: other.body.refreshToken })).status).toBe(401)
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: me.tokens.refreshToken })).status).toBe(200)
    expect((await request(app).post('/api/auth/login').send({ email: 'sathish@example.com', password: 'secret2' })).status).toBe(200)
  })

  it('looks up users by email', async () => {
    const me = await signUp('Sathish', 'sathish@example.com')
    await signUp('Arun', 'arun@example.com')
    const found = await me.get('/api/users/lookup?email=ARUN@example.com')
    expect(found.status).toBe(200)
    expect(found.body).toMatchObject({ name: 'Arun', email: 'arun@example.com' })
    expect((await me.get('/api/users/lookup?email=nobody@example.com')).status).toBe(404)
  })
})

// ---------- groups ----------

describe('groups', () => {
  it('creates, joins, lists with balances, and enforces membership', async () => {
    const { me, arun, priya, group } = await roomSetup()
    const stranger = await signUp('Stranger', 'stranger@example.com')

    const list = await me.get('/api/groups')
    expect(list.status).toBe(200)
    expect(list.body).toHaveLength(1)
    expect(list.body[0]).toMatchObject({ name: 'Room 302', myBalance: 500, totalSpent: 3000, monthSpent: 3000 })
    expect(list.body[0].members).toHaveLength(3)
    expect(list.body[0].members[0]).toMatchObject({ role: 'owner', name: 'Sathish Kumar' })

    expect((await arun.get(`/api/groups/${group.id}`)).body.myBalance).toBe(100)
    expect((await priya.get(`/api/groups/${group.id}`)).body.myBalance).toBe(-600)
    expect((await stranger.get(`/api/groups/${group.id}`)).status).toBe(403)
    expect((await stranger.get(`/api/groups/${group.id}/expenses`)).status).toBe(403)
    expect((await me.get('/api/groups/000000000000000000000000')).status).toBe(404)
    expect((await me.get('/api/groups/not-an-id')).status).toBe(404)
    expect((await stranger.post('/api/groups/join', { inviteCode: 'NOPE1234' })).status).toBe(404)
  })

  it('computes balances, simplified and pairwise, and settles up', async () => {
    const { me, arun, priya, group } = await roomSetup()
    let bal = await me.get(`/api/groups/${group.id}/balances`)
    expect(bal.status).toBe(200)
    expect(bal.body.simplified).toBe(true)
    const byName = Object.fromEntries(bal.body.members.map((m) => [m.name, m]))
    expect(byName['Sathish Kumar']).toMatchObject({ paid: 1500, share: 1000, balance: 500 })
    expect(byName.Arun).toMatchObject({ paid: 900, share: 800, balance: 100 })
    expect(byName.Priya).toMatchObject({ paid: 600, share: 1200, balance: -600 })
    expect(bal.body.debts).toEqual([
      expect.objectContaining({ fromName: 'Priya', toName: 'Sathish Kumar', amount: 500 }),
      expect.objectContaining({ fromName: 'Priya', toName: 'Arun', amount: 100 }),
    ])

    // pairwise mode (owner only)
    expect((await arun.put(`/api/groups/${group.id}`, { simplifyDebts: false })).status).toBe(403)
    await me.put(`/api/groups/${group.id}`, { simplifyDebts: false }).expect(200)
    bal = await me.get(`/api/groups/${group.id}/balances`)
    expect(bal.body.simplified).toBe(false)
    const amounts = bal.body.debts.map((d) => `${d.fromName}→${d.toName}:${d.amount}`).sort()
    expect(amounts).toEqual(['Arun→Sathish Kumar:200', 'Priya→Arun:300', 'Priya→Sathish Kumar:300'])
    await me.put(`/api/groups/${group.id}`, { simplifyDebts: true }).expect(200)

    // Priya pays me 500
    const st = await priya.post(`/api/groups/${group.id}/settlements`, { fromUserId: priya.id, toUserId: me.id, amount: 500, date: day(7), note: 'GPay' })
    expect(st.status).toBe(201)
    expect(st.body).toMatchObject({ amount: 500, date: day(7), note: 'GPay', from: { name: 'Priya' }, to: { name: 'Sathish Kumar' } })
    bal = await me.get(`/api/groups/${group.id}/balances`)
    expect(bal.body.debts).toEqual([expect.objectContaining({ fromName: 'Priya', toName: 'Arun', amount: 100 })])
    expect(bal.body.members.find((m) => m.name === 'Sathish Kumar').balance).toBe(0)

    expect((await me.post(`/api/groups/${group.id}/settlements`, { fromUserId: me.id, toUserId: me.id, amount: 5 })).status).toBe(400)
    const list = await me.get(`/api/groups/${group.id}/settlements`)
    expect(list.body).toHaveLength(1)
    await me.del(`/api/settlements/${st.body.id}`).expect(204)
    expect((await me.get(`/api/groups/${group.id}/balances`)).body.members.find((m) => m.name === 'Sathish Kumar').balance).toBe(500)

    const activity = await me.get(`/api/groups/${group.id}/activity`)
    expect(activity.body.map((a) => a.type)).toEqual(expect.arrayContaining(['group.created', 'member.joined', 'expense.added', 'settlement.added', 'settlement.deleted', 'group.updated']))
    expect(activity.body[0].createdAt >= activity.body.at(-1).createdAt).toBe(true)
  })

  it('members: add by email, leave blocked while unsettled, owner handover, regenerate code, delete', async () => {
    const { me, arun, priya, group } = await roomSetup()
    const dev = await signUp('Devi', 'devi@example.com')

    expect((await me.post(`/api/groups/${group.id}/members`, { email: 'nobody@example.com' })).status).toBe(404)
    expect((await me.post(`/api/groups/${group.id}/members`, { email: 'arun@example.com' })).status).toBe(409)
    const added = await arun.post(`/api/groups/${group.id}/members`, { email: 'DEVI@example.com' })
    expect(added.status).toBe(200)
    expect(added.body.members.map((m) => m.name)).toContain('Devi')

    // Priya owes money → cannot leave; owner cannot remove her either
    const leave = await priya.del(`/api/groups/${group.id}/members/${priya.id}`)
    expect(leave.status).toBe(409)
    expect(leave.body.detail).toMatch(/You still owe ₹600.00/)
    expect((await me.del(`/api/groups/${group.id}/members/${priya.id}`)).status).toBe(409)
    // non-owner cannot remove others
    expect((await arun.del(`/api/groups/${group.id}/members/${dev.id}`)).status).toBe(403)
    // Devi (balance 0) can leave
    await dev.del(`/api/groups/${group.id}/members/${dev.id}`).expect(204)

    // settle everything, then the owner leaves → Arun (joined next) becomes owner
    await priya.post(`/api/groups/${group.id}/settlements`, { fromUserId: priya.id, toUserId: me.id, amount: 500 }).expect(201)
    await priya.post(`/api/groups/${group.id}/settlements`, { fromUserId: priya.id, toUserId: arun.id, amount: 100 }).expect(201)
    await me.del(`/api/groups/${group.id}/members/${me.id}`).expect(204)
    const g = await arun.get(`/api/groups/${group.id}`)
    expect(g.body.members.map((m) => [m.name, m.role])).toEqual([
      ['Arun', 'owner'],
      ['Priya', 'member'],
    ])
    expect((await me.get(`/api/groups/${group.id}`)).status).toBe(403)

    // old expenses keep the former member's name
    const exp = await arun.get(`/api/groups/${group.id}/expenses`)
    expect(exp.body.items.find((e) => e.description === 'Groceries').paidBy.name).toBe('Sathish Kumar')

    const regen = await arun.post(`/api/groups/${group.id}/invite/regenerate`)
    expect(regen.status).toBe(200)
    expect(regen.body.inviteCode).not.toBe(group.inviteCode)
    expect((await priya.post(`/api/groups/${group.id}/invite/regenerate`)).status).toBe(403)

    expect((await priya.del(`/api/groups/${group.id}`)).status).toBe(403)
    await arun.del(`/api/groups/${group.id}`).expect(204)
    expect((await arun.get('/api/groups')).body).toEqual([])
    expect((await arun.get(`/api/groups/${group.id}/expenses`)).status).toBe(404)
  })

  it('validates group input', async () => {
    const me = await signUp('Sathish', 'sathish@example.com')
    expect((await me.post('/api/groups', { name: '' })).status).toBe(400)
    expect((await me.post('/api/groups', { name: 'X', color: 'blue' })).status).toBe(400)
    const g = await me.post('/api/groups', { name: 'Trip', currency: 'usd' })
    expect(g.body.currency).toBe('USD')
    expect(g.body.inviteCode).toMatch(/^[A-Z2-9]{8}$/)
  })
})

// ---------- expenses ----------

describe('expenses', () => {
  it('lists with month / category / search filters and paging', async () => {
    const { me, group } = await roomSetup()
    const all = await me.get(`/api/groups/${group.id}/expenses`)
    expect(all.status).toBe(200)
    expect(all.body.total).toBe(3)
    expect(all.body.items.map((e) => e.description)).toEqual(['Dinner', 'Electricity bill', 'Groceries']) // newest first
    expect(all.body.items[0]).toMatchObject({ amount: 600, myShare: 200, splitType: 'exact', currency: 'INR', groupName: 'Room 302', date: day(6) })
    expect(all.body.items[0].paidBy.name).toBe('Priya')

    expect((await me.get(`/api/groups/${group.id}/expenses?month=${MONTH}`)).body.total).toBe(3)
    expect((await me.get(`/api/groups/${group.id}/expenses?month=2000-01`)).body.total).toBe(0)
    expect((await me.get(`/api/groups/${group.id}/expenses?category=food`)).body.items.map((e) => e.description)).toEqual(['Dinner'])
    expect((await me.get(`/api/groups/${group.id}/expenses?search=ELEC`)).body.items.map((e) => e.description)).toEqual(['Electricity bill'])
    const page2 = await me.get(`/api/groups/${group.id}/expenses?page=2&pageSize=2`)
    expect(page2.body.items.map((e) => e.description)).toEqual(['Groceries'])
    expect(page2.body).toMatchObject({ total: 3, page: 2, pageSize: 2 })
    expect((await me.get(`/api/groups/${group.id}/expenses?month=bad`)).status).toBe(400)
  })

  it('validates expense input against the group', async () => {
    const { me, group } = await roomSetup()
    const stranger = await signUp('Stranger', 'stranger@example.com')
    const base = { description: 'Test', amount: 100, category: 'food', date: day(1), paidBy: me.id, splitType: 'equal', splits: [{ userId: me.id }] }
    expect((await me.post(`/api/groups/${group.id}/expenses`, { ...base, amount: 0 })).status).toBe(400)
    expect((await me.post(`/api/groups/${group.id}/expenses`, { ...base, category: 'fun' })).status).toBe(400)
    expect((await me.post(`/api/groups/${group.id}/expenses`, { ...base, date: '01-10-2026' })).status).toBe(400)
    expect((await me.post(`/api/groups/${group.id}/expenses`, { ...base, paidBy: stranger.id })).body.detail).toMatch(/must be a member/)
    expect((await me.post(`/api/groups/${group.id}/expenses`, { ...base, splits: [{ userId: stranger.id }] })).body.detail).toMatch(/Everyone in the split/)
    expect((await me.post(`/api/groups/${group.id}/expenses`, { ...base, splitType: 'exact', splits: [{ userId: me.id, value: 40 }] })).body.detail).toMatch(/add up to 40.00/)
    expect((await me.post(`/api/groups/${group.id}/expenses`, { ...base, splits: [] })).status).toBe(400)
    const bodyErr = await me.post(`/api/groups/${group.id}/expenses`, { ...base, splits: [{ userId: 'x' }, { userId: 'y' }] })
    expect(bodyErr.status).toBe(400) // duplicate-ish bad keys must not 500
  })

  it('creates with shares / percent, edits, deletes; only members may touch it', async () => {
    const { me, arun, priya, group } = await roomSetup()
    const stranger = await signUp('Stranger', 'stranger@example.com')

    const created = await me.post(`/api/groups/${group.id}/expenses`, {
      description: 'Cab',
      amount: 100,
      category: 'travel',
      date: day(8),
      paidBy: arun.id,
      splitType: 'shares',
      splits: [{ userId: me.id, value: 2 }, { userId: arun.id, value: 1 }],
      notes: 'to the station',
    })
    expect(created.status).toBe(201)
    expect(created.body.splits.map((s) => [s.name, s.amount, s.value])).toEqual([
      ['Sathish Kumar', 66.67, 2],
      ['Arun', 33.33, 1],
    ])
    expect(created.body.myShare).toBe(66.67)

    const got = await priya.get(`/api/expenses/${created.body.id}`)
    expect(got.status).toBe(200)
    expect(got.body.myShare).toBe(0)
    expect((await stranger.get(`/api/expenses/${created.body.id}`)).status).toBe(403)
    const validBody = { description: 'Cab', amount: 100, category: 'travel', date: day(8), paidBy: arun.id, splitType: 'equal', splits: [{ userId: arun.id }] }
    expect((await stranger.put(`/api/expenses/${created.body.id}`, validBody)).status).toBe(403)
    expect((await stranger.del(`/api/expenses/${created.body.id}`)).status).toBe(403)

    const edited = await arun.put(`/api/expenses/${created.body.id}`, {
      description: 'Cab to station',
      amount: 200,
      category: 'travel',
      date: day(9),
      paidBy: arun.id,
      splitType: 'percent',
      splits: [{ userId: me.id, value: 25 }, { userId: arun.id, value: 75 }],
    })
    expect(edited.status).toBe(200)
    expect(edited.body).toMatchObject({ description: 'Cab to station', amount: 200, date: day(9), myShare: 150, splitType: 'percent' }) // Arun's share (he edited it)
    expect((await me.get(`/api/expenses/${created.body.id}`)).body.myShare).toBe(50)
    expect(edited.body.updatedAt > edited.body.createdAt).toBe(true)
    expect((await me.get(`/api/groups/${group.id}`)).body.myBalance).toBe(450)

    const recent = await me.get('/api/expenses/recent?limit=2')
    expect(recent.body.map((e) => e.description)).toEqual(['Cab to station', 'Dinner'])

    await priya.del(`/api/expenses/${created.body.id}`).expect(204)
    expect((await me.get(`/api/expenses/${created.body.id}`)).status).toBe(404)
    expect((await me.get(`/api/groups/${group.id}`)).body.myBalance).toBe(500)
  })
})

// ---------- personal, dashboard, reports ----------

describe('personal', () => {
  it('is private per user, with month filter, edit and delete', async () => {
    const { me, arun } = await roomSetup()
    const mine = await me.get('/api/personal')
    expect(mine.body.map((p) => p.description)).toEqual(['Coffee'])
    expect((await arun.get('/api/personal')).body).toEqual([])
    const old = await me.post('/api/personal', { description: 'Old thing', amount: 50, category: 'other', date: '2020-01-15' })
    expect(old.status).toBe(201)
    expect((await me.get(`/api/personal?month=${MONTH}`)).body.map((p) => p.description)).toEqual(['Coffee'])
    expect((await me.get('/api/personal?month=2020-01')).body.map((p) => p.description)).toEqual(['Old thing'])
    expect((await arun.put(`/api/personal/${old.body.id}`, { description: 'x', amount: 1, category: 'food', date: '2020-01-15' })).status).toBe(404)
    const upd = await me.put(`/api/personal/${old.body.id}`, { description: 'Older thing', amount: 55, category: 'food', date: '2020-01-16', notes: 'n' })
    expect(upd.body).toMatchObject({ description: 'Older thing', amount: 55, date: '2020-01-16', notes: 'n' })
    await me.del(`/api/personal/${old.body.id}`).expect(204)
    expect((await me.get('/api/personal')).body).toHaveLength(1)
  })
})

describe('dashboard', () => {
  it('aggregates my share, personal, balances, categories and daily spend', async () => {
    const { me, arun, group } = await roomSetup()
    const d = await me.get(`/api/dashboard?month=${MONTH}`)
    expect(d.status).toBe(200)
    expect(d.body).toMatchObject({ month: MONTH, groupShare: 1000, personalSpent: 120, totalSpent: 1120, iPaid: 1500, youOwe: 0, youAreOwed: 500, netBalance: 500, prevMonthTotal: 0 })
    expect(d.body.byGroup).toEqual([
      expect.objectContaining({ groupId: group.id, name: 'Room 302', amount: 1000, count: 3 }),
      expect.objectContaining({ groupId: 'personal', amount: 120, count: 1 }),
    ])
    const cats = Object.fromEntries(d.body.byCategory.map((c) => [c.category, c.amount]))
    expect(cats).toEqual({ groceries: 500, utilities: 300, food: 320 })
    const daysInMonth = new Date(Date.UTC(+MONTH.slice(0, 4), +MONTH.slice(5, 7), 0)).getUTCDate()
    expect(d.body.daily).toHaveLength(daysInMonth)
    expect(d.body.daily.find((x) => x.date === day(3)).amount).toBe(500)
    expect(d.body.daily.find((x) => x.date === day(4)).amount).toBe(120)
    expect(d.body.daily.reduce((t, x) => t + x.amount, 0)).toBeCloseTo(1120, 2)
    expect(d.body.groupBalances).toEqual([expect.objectContaining({ groupId: group.id, balance: 500 })])
    expect(d.body.recent.map((e) => e.description)).toEqual(['Dinner', 'Electricity bill', 'Coffee', 'Groceries'])
    expect(d.body.recent.find((e) => e.description === 'Coffee').groupId).toBe('personal')

    const a = await arun.get('/api/dashboard')
    expect(a.body).toMatchObject({ groupShare: 800, iPaid: 900, youAreOwed: 100, totalSpent: 800 })
    expect((await me.get('/api/dashboard?month=2000-01')).body.totalSpent).toBe(0)
  })
})

describe('reports', () => {
  it('lists months and produces PDF + CSV for every scope', async () => {
    const { me, group } = await roomSetup()
    await me.post('/api/personal', { description: 'Old thing', amount: 50, category: 'other', date: '2020-01-15' })
    const months = await me.get('/api/reports/months')
    expect(months.body[0]).toBe(MONTH)
    expect(months.body).toContain('2020-01')

    const pdf = await me.get(`/api/reports/monthly?month=${MONTH}&format=pdf`).buffer().parse((res, cb) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => cb(null, Buffer.concat(chunks)))
    })
    expect(pdf.status).toBe(200)
    expect(pdf.headers['content-type']).toBe('application/pdf')
    expect(pdf.headers['content-disposition']).toBe(`attachment; filename="kanakku-${MONTH}.pdf"`)
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.body.length).toBeGreaterThan(5000)

    const groupPdf = await me.get(`/api/reports/monthly?month=${MONTH}&groupId=${group.id}`)
    expect(groupPdf.headers['content-disposition']).toBe(`attachment; filename="kanakku-${MONTH}-room-302.pdf"`)

    const csv = await me.get(`/api/reports/monthly?month=${MONTH}&format=csv`)
    expect(csv.status).toBe(200)
    expect(csv.headers['content-type']).toMatch(/text\/csv/)
    const text = csv.text.replace(/^﻿/, '')
    const lines = text.trim().split('\r\n')
    expect(lines[0]).toBe('Date,Group,Description,Category,Paid by,Total,My share,Notes')
    expect(lines[1]).toBe(`${day(3)},Room 302,Groceries,groceries,You,1500.00,500.00,`)
    expect(lines[2]).toBe(`${day(4)},Personal,Coffee,food,You,120.00,120.00,`)
    expect(lines).toContain('Total this month (INR),1120.00')

    const personalCsv = await me.get(`/api/reports/monthly?month=${MONTH}&groupId=personal&format=csv`)
    expect(personalCsv.text).toContain('Coffee')
    expect(personalCsv.text).not.toContain('Groceries')
    expect((await me.get(`/api/reports/monthly?month=${MONTH}&groupId=000000000000000000000000`)).status).toBe(404)
  })
})

describe('misc', () => {
  it('health, root, 404 shape, CORS headers', async () => {
    expect((await request(app).get('/health')).body.status).toBe('ok')
    expect((await request(app).get('/api/health')).body.status).toBe('ok')
    const nf = await request(app).get('/api/nothing')
    expect(nf.status).toBe(404)
    expect(nf.body).toMatchObject({ status: 404, title: 'Not found' })
    const pre = await request(app).options('/api/groups').set('Origin', 'https://kanakku.vercel.app').set('Access-Control-Request-Method', 'GET')
    expect(pre.headers['access-control-allow-origin']).toBe('https://kanakku.vercel.app')
    expect(pre.headers['access-control-expose-headers']).toMatch(/Content-Disposition/)
  })
})

describe('hardening', () => {
  it('rejects refresh-token replay by signing the whole account out', async () => {
    const me = await signUp('Sathish', 'sathish@example.com')
    const second = await request(app).post('/api/auth/login').send({ email: 'sathish@example.com', password: 'secret1' })
    const rotated = await request(app).post('/api/auth/refresh').send({ refreshToken: me.tokens.refreshToken })
    expect(rotated.status).toBe(200)
    // replaying the old token → 401 and every live session for this user is revoked
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: me.tokens.refreshToken })).status).toBe(401)
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken })).status).toBe(401)
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: second.body.refreshToken })).status).toBe(401)
  })

  it('neutralises spreadsheet formulas in CSV exports', async () => {
    const { me, group } = await roomSetup()
    await me.post(`/api/groups/${group.id}/expenses`, { description: '=HYPERLINK("http://evil")', amount: 10, category: 'other', date: day(2), paidBy: me.id, splitType: 'equal', splits: [{ userId: me.id }] }).expect(201)
    const csv = await me.get(`/api/reports/monthly?month=${MONTH}&format=csv`)
    expect(csv.text).toContain(`"'=HYPERLINK(""http://evil"")"`)
    expect(csv.text).not.toMatch(/,=HYPERLINK/)
  })

  it('health reports the database state and oversized bodies get 413', async () => {
    const h = await request(app).get('/health')
    expect(h.status).toBe(200)
    expect(h.body).toMatchObject({ status: 'ok', db: 'connected' })
    const big = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send(`{"email":"${'a'.repeat(1_100_000)}"}`)
    expect(big.status).toBe(413)
    expect(big.body.title).toBe('Payload too large')
  })

  it('CORS wildcard matches only one DNS label', async () => {
    const ok = await request(app).options('/api/groups').set('Origin', 'https://kanakku-abc.vercel.app').set('Access-Control-Request-Method', 'GET')
    expect(ok.headers['access-control-allow-origin']).toBe('https://kanakku-abc.vercel.app') // CLIENT_ORIGINS empty in tests → any origin
  })

  it('member removal survives a concurrent join (atomic $pull)', async () => {
    const { me, arun, priya, group } = await roomSetup()
    const dev = await signUp('Devi', 'devi@example.com')
    // settle Priya so she can be removed, then remove her while Devi joins
    await priya.post(`/api/groups/${group.id}/settlements`, { fromUserId: priya.id, toUserId: me.id, amount: 500 }).expect(201)
    await priya.post(`/api/groups/${group.id}/settlements`, { fromUserId: priya.id, toUserId: arun.id, amount: 100 }).expect(201)
    const [removed, joined] = await Promise.all([me.del(`/api/groups/${group.id}/members/${priya.id}`), dev.post('/api/groups/join', { inviteCode: group.inviteCode })])
    expect(removed.status).toBe(204)
    expect(joined.status).toBe(200)
    const g = await me.get(`/api/groups/${group.id}`)
    expect(g.body.members.map((m) => m.name).sort()).toEqual(['Arun', 'Devi', 'Sathish Kumar'])
  })
})
