/** Runs the demo seed against the fake server and checks the numbers it produces make sense. */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import request from 'supertest'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDb, disconnectDb } from '../src/db.js'
import { startFakeMongo } from './fakeMongo.js'

const run = promisify(execFile)
let srv

beforeAll(async () => {
  srv = await startFakeMongo()
})
afterAll(async () => {
  await disconnectDb()
  await srv.stop()
})

it('seeds a demo room that the dashboard can read', async () => {
  const { stdout } = await run('node', ['scripts/seed.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, MONGODB_URI: srv.uri, MONGODB_DB: 'kanakku_seed', NODE_ENV: 'test', JWT_SECRET: 'test-secret-test-secret-test-secret-0123456789', LOG_LEVEL: 'silent' },
  })
  expect(stdout).toContain('Seeded demo data')

  await connectDb(srv.uri, 'kanakku_seed')
  const app = createApp()
  const login = await request(app).post('/api/auth/login').send({ email: 'sathish@demo.kanakku', password: 'demo1234' })
  expect(login.status).toBe(200)
  const auth = `Bearer ${login.body.accessToken}`

  const groups = await request(app).get('/api/groups').set('Authorization', auth)
  expect(groups.body.map((g) => g.name).sort()).toEqual(['Goa trip', 'Room 302'])
  const room = groups.body.find((g) => g.name === 'Room 302')
  expect(room.members).toHaveLength(4)
  expect(room.totalSpent).toBeGreaterThan(50000)

  const balances = await request(app).get(`/api/groups/${room.id}/balances`).set('Authorization', auth)
  const total = balances.body.members.reduce((t, m) => t + m.balance, 0)
  expect(Math.abs(total)).toBeLessThan(0.05) // balances always net to zero
  expect(balances.body.debts.length).toBeGreaterThan(0)

  const dash = await request(app).get('/api/dashboard').set('Authorization', auth)
  expect(dash.body.byGroup.length).toBeGreaterThanOrEqual(1)
  expect(dash.body.recent.length).toBe(10)
  expect(dash.body.totalSpent).toBeCloseTo(dash.body.groupShare + dash.body.personalSpent, 2)

  const months = await request(app).get('/api/reports/months').set('Authorization', auth)
  expect(months.body.length).toBeGreaterThanOrEqual(3)
  const pdf = await request(app).get(`/api/reports/monthly?month=${months.body[1]}`).set('Authorization', auth).buffer().parse((res, cb) => {
    const chunks = []
    res.on('data', (c) => chunks.push(c))
    res.on('end', () => cb(null, Buffer.concat(chunks)))
  })
  expect(pdf.status).toBe(200)
  expect(pdf.body.length).toBeGreaterThan(8000)
})
