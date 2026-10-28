import { ApiError } from '../lib/errors.js'
import { isObjectId } from '../lib/util.js'
import { verifyAccessToken } from '../services/auth.js'

/** Requires a valid Bearer access token; sets req.userId. */
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null
  if (!token) return next(ApiError.unauthorized())
  try {
    const payload = verifyAccessToken(token)
    if (!isObjectId(payload.sub)) return next(ApiError.unauthorized())
    req.userId = payload.sub
    next()
  } catch {
    next(ApiError.unauthorized('Your session has expired. Please sign in again.', 'Session expired'))
  }
}
