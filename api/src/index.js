import mongoose from 'mongoose'
import { createApp } from './app.js'
import { config } from './config.js'
import { connectDb } from './db.js'
import { logger } from './lib/logger.js'

const app = createApp()

// Listen first so Render's health check passes while MongoDB connects.
const server = app.listen(config.port, '0.0.0.0', () => logger.info(`Kanakku API listening on http://0.0.0.0:${config.port}`))

// Mongoose does not retry a failed *initial* connection on its own, so keep trying with backoff.
async function connectWithRetry(delay = 2_000) {
  for (;;) {
    try {
      await connectDb()
      return
    } catch (err) {
      logger.error({ err: err?.message ?? err }, `MongoDB connection failed — check MONGODB_URI and the Atlas IP allowlist. Retrying in ${delay / 1000}s`)
      await new Promise((r) => setTimeout(r, delay))
      delay = Math.min(delay * 2, 60_000)
    }
  }
}
connectWithRetry()

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    logger.info(`${signal} received, shutting down`)
    server.close(() => {
      mongoose.disconnect().finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
