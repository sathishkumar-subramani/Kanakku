import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { ApiError } from './errors.js'

// ---------- ids ----------

export const isObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)

export function ensureObjectId(id, what = 'Resource') {
  if (!isObjectId(id)) throw ApiError.notFound(what)
  return new mongoose.Types.ObjectId(id)
}

export const oid = (id) => new mongoose.Types.ObjectId(String(id))
export const idStr = (id) => (id == null ? id : String(id))
export const sameId = (a, b) => String(a) === String(b)

// ---------- calendar days / months (UTC midnight, "YYYY-MM-DD") ----------

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/
const MONTH_RE = /^(\d{4})-(\d{2})$/

/** "YYYY-MM-DD" (a trailing time part is ignored) → Date at UTC midnight. */
export function parseDay(value, field = 'date') {
  if (value == null || value === '') return todayUtc()
  const m = DAY_RE.exec(String(value).trim())
  if (!m) throw ApiError.badRequest('Date must be in YYYY-MM-DD format.', field)
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if (isNaN(d.getTime()) || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3])
    throw ApiError.badRequest('That date does not exist.', field)
  return d
}

export function todayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export const dayKey = (d) => d.toISOString().slice(0, 10)
export const monthKey = (d) => d.toISOString().slice(0, 7)

/** "YYYY-MM" → [start, end) in UTC. Defaults to the current UTC month. */
export function monthRange(month) {
  let start
  if (!month) {
    const now = new Date()
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  } else {
    const m = MONTH_RE.exec(String(month).trim())
    if (!m || +m[2] < 1 || +m[2] > 12) throw ApiError.badRequest('Month must be in YYYY-MM format.', 'month')
    start = new Date(Date.UTC(+m[1], +m[2] - 1, 1))
  }
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  return { start, end, key: monthKey(start) }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const monthLabel = (key) => `${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`
export const dayShort = (d) => `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`

// ---------- money ----------

export const round2 = (v) => {
  const n = Number(v)
  const r = (Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100
  return r === 0 ? 0 : r // never -0
}
export const isZero = (v) => Math.abs(v) < 0.005
export const sum = (arr, f = (x) => x) => round2(arr.reduce((s, x) => s + f(x), 0))

const SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$' }

/** "₹12,34,567.50" with Indian grouping for INR, standard grouping otherwise. */
export function money(amount, currency = 'INR') {
  const abs = Math.abs(amount)
  const number = abs.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${amount < 0 ? '-' : ''}${SYMBOLS[currency] ?? currency + ' '}${number}`
}

// ---------- misc ----------

export const CATEGORIES = ['food', 'groceries', 'rent', 'utilities', 'travel', 'entertainment', 'shopping', 'health', 'household', 'other']
export const SPLIT_TYPES = ['equal', 'exact', 'percent', 'shares']
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']
export const AVATAR_PALETTE = ['#E2590B', '#1D8F62', '#2F6FED', '#C85CD6', '#CF3E38', '#2BB3C9', '#9A7B4F', '#F5B400']

export const isHexColor = (v) => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v.trim())

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newInviteCode() {
  const bytes = crypto.randomBytes(8)
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('')
}

export function avatarColorFor(email) {
  const hash = crypto.createHash('md5').update(email).digest()
  return AVATAR_PALETTE[hash[0] % AVATAR_PALETTE.length]
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
export const randomToken = () => crypto.randomBytes(48).toString('base64url')
