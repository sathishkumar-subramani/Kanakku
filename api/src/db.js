import mongoose from 'mongoose'
import { config } from './config.js'
import { logger } from './lib/logger.js'

mongoose.set('strictQuery', true)

export async function connectDb(uri = config.mongoUri, dbName = config.mongoDb) {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 15_000, autoIndex: false })
  logger.info({ db: dbName }, 'MongoDB connected')
  // Build the indexes declared on the schemas (unique email / inviteCode / tokenHash, query indexes).
  // createIndexes (not syncIndexes) so an index you add by hand in Atlas is never dropped on boot.
  for (const m of Object.values(mongoose.models)) {
    try {
      await m.createIndexes()
    } catch (err) {
      logger.error({ err: err?.message ?? err, model: m.modelName }, 'Could not create indexes — unique constraints may be missing')
    }
  }
}

export async function disconnectDb() {
  await mongoose.disconnect()
}
