import { Router } from 'express'
import { ApiError } from '../lib/errors.js'
import { body, email as emailSchema, schemas } from '../lib/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { User } from '../models/index.js'
import * as auth from '../services/auth.js'
import { requireUser } from '../services/data.js'
import { userDto } from '../services/mappers.js'

export const authRouter = Router()

authRouter.post('/register', body(schemas.register), async (req, res) => {
  res.status(201).json(await auth.register(req.body))
})

authRouter.post('/login', body(schemas.login), async (req, res) => {
  res.json(await auth.login(req.body))
})

authRouter.post('/refresh', body(schemas.refresh), async (req, res) => {
  res.json(await auth.refresh(req.body.refreshToken))
})

authRouter.post('/logout', body(schemas.logout), async (req, res) => {
  await auth.logout(req.body.refreshToken)
  res.status(204).end()
})

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(userDto(await requireUser(req.userId)))
})

authRouter.put('/me', requireAuth, body(schemas.updateProfile), async (req, res) => {
  res.json(await auth.updateProfile(req.userId, req.body))
})

authRouter.put('/password', requireAuth, body(schemas.changePassword), async (req, res) => {
  await auth.changePassword(req.userId, req.body)
  res.status(204).end()
})

// ---------- users ----------

export const usersRouter = Router()

usersRouter.get('/lookup', requireAuth, async (req, res) => {
  const parsed = emailSchema.safeParse(req.query.email)
  if (!parsed.success) throw ApiError.badRequest('Enter a valid email address.', 'email')
  const user = await User.findOne({ email: parsed.data }).lean()
  if (!user) throw new ApiError(404, 'No Kanakku account with that email yet.')
  res.json({ id: String(user._id), name: user.name, email: user.email, avatarColor: user.avatarColor })
})
