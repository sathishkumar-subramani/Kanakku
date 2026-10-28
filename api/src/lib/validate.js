import { z } from 'zod'
import { CATEGORIES, CURRENCIES, SPLIT_TYPES, isHexColor, isObjectId } from './util.js'

/** Parses req.body with a zod schema; throws ZodError (→ 400 problem) on failure. */
export const body = (schema) => (req, _res, next) => {
  req.body = schema.parse(req.body ?? {})
  next()
}

export const query = (schema) => (req, _res, next) => {
  req.q = schema.parse(req.query ?? {})
  next()
}

// ---------- building blocks ----------

export const objectId = (what = 'id') => z.string().refine(isObjectId, `${what} is not valid.`)
export const trimmed = (min, max, label) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`)
export const amount = z.coerce.number({ error: 'Amount must be a number.' }).gt(0, 'Amount must be greater than 0.').lte(1_000_000_000, 'That amount is too large.')
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Date must be in YYYY-MM-DD format.')
export const month = z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format.')
export const category = z.enum(CATEGORIES, { error: 'Pick a valid category.' })
export const currency = z.string().trim().toUpperCase().pipe(z.enum(CURRENCIES, { error: `Currency must be one of ${CURRENCIES.join(', ')}.` }))
export const hexColor = z.string().trim().refine(isHexColor, 'Colour must look like #RRGGBB.').transform((s) => s.toUpperCase())
export const email = z.string({ error: 'Email is required.' }).trim().toLowerCase().pipe(z.email('Enter a valid email address.')).pipe(z.string().max(120, 'Email is too long.'))
export const password = z.string({ error: 'Password is required.' }).min(6, 'Password must be at least 6 characters.').max(100)
export const notes = z.string().trim().max(500, 'Notes must be at most 500 characters.').optional().nullable()

// ---------- schemas ----------

export const schemas = {
  register: z.object({ name: trimmed(1, 60, 'Name'), email, password }),
  login: z.object({ email, password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.') }),
  refresh: z.object({ refreshToken: z.string().min(1, 'Refresh token is required.') }),
  logout: z.object({ refreshToken: z.string().optional() }),
  updateProfile: z.object({ name: trimmed(1, 60, 'Name').optional(), currency: currency.optional(), avatarColor: hexColor.optional() }),
  changePassword: z.object({
    currentPassword: z.string({ error: 'Current password is required.' }).min(1, 'Current password is required.'),
    newPassword: password,
    refreshToken: z.string().optional(),
  }),

  createGroup: z.object({
    name: trimmed(1, 60, 'Group name'),
    emoji: z.string().trim().max(16).optional(),
    color: hexColor.optional(),
    currency: currency.optional(),
  }),
  updateGroup: z.object({
    name: trimmed(1, 60, 'Group name').optional(),
    emoji: z.string().trim().min(1).max(16).optional(),
    color: hexColor.optional(),
    simplifyDebts: z.boolean().optional(),
  }),
  join: z.object({ inviteCode: z.string().trim().min(1, 'Invite code is required.') }),
  addMember: z.object({ email }),

  expense: z.object({
    description: trimmed(1, 120, 'Description'),
    amount,
    category,
    date: day,
    notes,
    paidBy: objectId('paidBy'),
    splitType: z.enum(SPLIT_TYPES, { error: 'Split type must be equal, exact, percent or shares.' }),
    splits: z.array(z.object({ userId: objectId('userId'), value: z.coerce.number().default(0) })).min(1, 'Select at least one person to split with.'),
  }),
  expenseQuery: z.object({
    month: month.optional(),
    category: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  }),

  settlement: z.object({
    fromUserId: objectId('fromUserId'),
    toUserId: objectId('toUserId'),
    amount,
    date: day.optional(),
    note: z.string().trim().max(300).optional().nullable(),
  }),

  personal: z.object({ description: trimmed(1, 120, 'Description'), amount, category, date: day, notes }),
  monthQuery: z.object({ month: month.optional() }),
  reportQuery: z.object({ month: month.optional(), groupId: z.string().optional(), format: z.enum(['pdf', 'csv']).default('pdf') }),
  limitQuery: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
}
