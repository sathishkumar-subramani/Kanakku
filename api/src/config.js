import 'dotenv/config'

const env = process.env

function required(name, fallback) {
  const v = env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`Missing environment variable ${name}`)
  return v
}

export const config = {
  env: env.NODE_ENV ?? 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT ?? 5080),
  mongoUri: required('MONGODB_URI', env.NODE_ENV === 'production' ? undefined : 'mongodb://127.0.0.1:27017'),
  mongoDb: env.MONGODB_DB ?? 'kanakku',
  jwtSecret: required('JWT_SECRET', env.NODE_ENV === 'production' ? undefined : 'dev-only-secret-change-me-in-production-please-0123456789'),
  jwtIssuer: 'kanakku',
  jwtAudience: 'kanakku-clients',
  accessTokenMinutes: Number(env.ACCESS_TOKEN_MINUTES ?? 60),
  refreshTokenDays: Number(env.REFRESH_TOKEN_DAYS ?? 60),
  /** Comma-separated list; empty = allow any origin (bearer tokens, no cookies). Supports https://*.vercel.app */
  clientOrigins: (env.CLIENT_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '*'),
  logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : 'info'),
}

if (config.jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters long.')
if (config.isProd && config.jwtSecret.startsWith('dev-only-secret')) throw new Error('Set a real JWT_SECRET in production.')
