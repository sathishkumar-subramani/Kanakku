import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import rateLimit from 'express-rate-limit'
import { pinoHttp } from 'pino-http'
import { config } from './config.js'
import { errorHandler, notFoundHandler } from './lib/errors.js'
import { logger } from './lib/logger.js'
import { authRouter, usersRouter } from './routes/auth.js'
import { dashboardRouter, reportsRouter } from './routes/dashboard.js'
import { expensesRouter, groupExpensesRouter } from './routes/expenses.js'
import { groupsRouter } from './routes/groups.js'
import { groupSettlementsRouter, personalRouter, settlementsRouter } from './routes/settlements.js'

/** Matches an origin against the CLIENT_ORIGINS list; "https://*.vercel.app" style wildcards allowed. */
function originAllowed(origin) {
  if (config.clientOrigins.length === 0) return true
  return config.clientOrigins.some((pattern) => {
    if (pattern === origin) return true
    if (!pattern.includes('*')) return false
    const re = new RegExp('^' + pattern.split('*').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[A-Za-z0-9-]+') + '$')
    return re.test(origin)
  })
}

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1) // Render sits behind a proxy

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || originAllowed(origin)),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition', 'Content-Length'],
      maxAge: 600,
    }),
  )
  if (!config.isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/api/health' },
        // One compact line per request; never log headers (bearer tokens) or bodies.
        serializers: {
          req: (req) => ({ method: req.method, url: req.url.split('?')[0] }),
          res: (res) => ({ status: res.statusCode }),
        },
        customSuccessMessage: (req, res) => `${req.method} ${req.url.split('?')[0]} → ${res.statusCode}`,
        customErrorMessage: (req, res) => `${req.method} ${req.url.split('?')[0]} → ${res.statusCode}`,
      }),
    )
  }
  app.use(express.json({ limit: '1mb' }))

  // 200 while MongoDB is connected, 503 otherwise — so a bad MONGODB_URI is visible instead of a "healthy" service that 500s.
  const health = (_req, res) => {
    const db = mongoose.connection.readyState === 1
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db: db ? 'connected' : 'disconnected', time: new Date().toISOString() })
  }
  app.get('/health', health)
  app.get('/api/health', health)
  app.get('/', (_req, res) => res.json({ name: 'Kanakku API', docs: 'See docs/API.md in the repository', health: '/health' }))

  // Brute-force / bcrypt-CPU protection on the two anonymous, expensive endpoints.
  const limiter = (windowMs, limit) =>
    rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => config.isTest, message: { status: 429, title: 'Too many requests', detail: 'Too many attempts. Please wait a few minutes and try again.', errors: null } })
  app.use('/api/auth/login', limiter(15 * 60_000, 30))
  app.use('/api/auth/register', limiter(60 * 60_000, 20))

  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/groups', groupsRouter)
  app.use('/api/groups/:id/expenses', groupExpensesRouter)
  app.use('/api/groups/:id/settlements', groupSettlementsRouter)
  app.use('/api/expenses', expensesRouter)
  app.use('/api/settlements', settlementsRouter)
  app.use('/api/personal', personalRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/reports', reportsRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
