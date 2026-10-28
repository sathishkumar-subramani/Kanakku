import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { ApiError } from '../lib/errors.js'
import { avatarColorFor, randomToken, sha256 } from '../lib/util.js'
import { RefreshToken, User } from '../models/index.js'
import { userDto } from './mappers.js'

const BCRYPT_ROUNDS = 11

export function signAccessToken(user) {
  const expiresAt = new Date(Date.now() + config.accessTokenMinutes * 60_000)
  const token = jwt.sign({ email: user.email, name: user.name }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(user._id),
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    expiresIn: `${config.accessTokenMinutes}m`,
  })
  return { token, expiresAt }
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: config.jwtIssuer, audience: config.jwtAudience })
}

async function issueTokens(user) {
  const { token: accessToken, expiresAt } = signAccessToken(user)
  const refreshToken = randomToken()
  await RefreshToken.create({
    tokenHash: sha256(refreshToken),
    userId: user._id,
    expiresAt: new Date(Date.now() + config.refreshTokenDays * 86_400_000),
  })
  return { accessToken, refreshToken, accessTokenExpiresAt: expiresAt }
}

export async function register({ name, email, password }) {
  if (await User.exists({ email })) throw ApiError.conflict('An account with that email already exists. Try signing in.')
  let user
  try {
    user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), currency: 'INR', avatarColor: avatarColorFor(email) })
  } catch (err) {
    if (err?.code === 11000) throw ApiError.conflict('An account with that email already exists. Try signing in.')
    throw err
  }
  const tokens = await issueTokens(user)
  return { user: userDto(user), ...tokens }
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).lean()
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw ApiError.unauthorized('Email or password is incorrect.', 'Sign-in failed')
  const tokens = await issueTokens(user)
  return { user: userDto(user), ...tokens }
}

export async function refresh(refreshToken) {
  const hash = sha256(refreshToken)
  const now = new Date()
  // Atomically revoke the presented token; if it was already revoked/expired/unknown, the session is dead.
  const stored = await RefreshToken.findOneAndUpdate(
    { tokenHash: hash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, rotated: true } },
    { returnDocument: 'before' },
  ).lean()
  if (!stored) {
    // A token that was already rotated is being replayed: someone else holds the live chain. Sign the whole account out.
    // (Tokens revoked by logout / password change are not replays — those just 401.)
    const reused = await RefreshToken.findOne({ tokenHash: hash, rotated: true }).lean()
    if (reused) await RefreshToken.updateMany({ userId: reused.userId, revokedAt: null }, { $set: { revokedAt: now } })
    throw ApiError.unauthorized('Your session has expired. Please sign in again.', 'Session expired')
  }
  const user = await User.findById(stored.userId).lean()
  if (!user) throw ApiError.unauthorized('Account not found. Please sign in again.')
  return issueTokens(user)
}

export async function logout(refreshToken) {
  if (!refreshToken) return
  await RefreshToken.updateOne({ tokenHash: sha256(refreshToken), revokedAt: null }, { $set: { revokedAt: new Date() } })
}

export async function updateProfile(userId, { name, currency, avatarColor }) {
  const set = {}
  if (name !== undefined) set.name = name
  if (currency !== undefined) set.currency = currency
  if (avatarColor !== undefined) set.avatarColor = avatarColor
  if (Object.keys(set).length) await User.updateOne({ _id: userId }, { $set: set })
  const user = await User.findById(userId).lean()
  if (!user) throw ApiError.unauthorized('Account not found. Please sign in again.')
  return userDto(user)
}

export async function changePassword(userId, { currentPassword, newPassword, refreshToken }) {
  const user = await User.findById(userId).lean()
  if (!user) throw ApiError.unauthorized('Account not found. Please sign in again.')
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw ApiError.badRequest('Current password is incorrect.', 'currentPassword')
  await User.updateOne({ _id: userId }, { $set: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) } })
  // Sign out every other device; the device making the change keeps its refresh token.
  const filter = { userId: user._id, revokedAt: null }
  if (refreshToken) filter.tokenHash = { $ne: sha256(refreshToken) }
  await RefreshToken.updateMany(filter, { $set: { revokedAt: new Date() } })
}
