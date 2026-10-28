import mongoose from 'mongoose'

const { Schema, Types } = mongoose
const ObjectId = Schema.Types.ObjectId

const opts = (extra = {}) => ({ versionKey: false, minimize: false, ...extra })

// ---------- users ----------

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    currency: { type: String, default: 'INR' },
    avatarColor: { type: String, default: '#E2590B' },
    createdAt: { type: Date, default: Date.now },
  },
  opts(),
)

// Refresh tokens live in their own collection: atomic per-token updates, no array races.
const refreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    rotated: { type: Boolean, default: false }, // true when revoked because it was exchanged for a new token (replay detection)
  },
  opts(),
)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 }) // Mongo deletes dead tokens a week after expiry

// ---------- groups ----------

const memberSchema = new Schema(
  {
    userId: { type: ObjectId, required: true },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const groupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    emoji: { type: String, default: '🏠' },
    color: { type: String, default: '#E2590B' },
    currency: { type: String, default: 'INR' },
    inviteCode: { type: String, required: true, unique: true },
    simplifyDebts: { type: Boolean, default: true },
    createdBy: { type: ObjectId, required: true },
    createdAt: { type: Date, default: Date.now },
    members: { type: [memberSchema], default: [] },
  },
  opts(),
)
groupSchema.index({ 'members.userId': 1 })

// ---------- expenses ----------

const splitSchema = new Schema(
  {
    userId: { type: ObjectId, required: true },
    amount: { type: Number, required: true }, // money this member owes for the expense
    value: { type: Number, default: 0 }, // raw client value (rupees / percent / shares); 0 for equal
  },
  { _id: false },
)

const expenseSchema = new Schema(
  {
    groupId: { type: ObjectId, required: true },
    description: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    category: { type: String, default: 'other' },
    date: { type: Date, required: true }, // calendar day stored as UTC midnight
    notes: { type: String, default: null },
    paidBy: { type: ObjectId, required: true },
    splitType: { type: String, default: 'equal' },
    splits: { type: [splitSchema], default: [] },
    createdBy: { type: ObjectId, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  opts(),
)
expenseSchema.index({ groupId: 1, date: -1 })

// ---------- settlements ----------

const settlementSchema = new Schema(
  {
    groupId: { type: ObjectId, required: true },
    fromUserId: { type: ObjectId, required: true },
    toUserId: { type: ObjectId, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    note: { type: String, default: null },
    createdBy: { type: ObjectId, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  opts(),
)
settlementSchema.index({ groupId: 1, date: -1 })

// ---------- personal expenses ----------

const personalExpenseSchema = new Schema(
  {
    userId: { type: ObjectId, required: true },
    description: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true },
    category: { type: String, default: 'other' },
    date: { type: Date, required: true },
    notes: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  opts(),
)
personalExpenseSchema.index({ userId: 1, date: -1 })

// ---------- activity ----------

const activitySchema = new Schema(
  {
    groupId: { type: ObjectId, required: true },
    actorId: { type: ObjectId, required: true },
    actorName: { type: String, default: '' },
    type: { type: String, required: true },
    message: { type: String, required: true },
    refId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  opts(),
)
activitySchema.index({ groupId: 1, createdAt: -1 })

export const User = mongoose.model('User', userSchema, 'users')
export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema, 'refreshTokens')
export const Group = mongoose.model('Group', groupSchema, 'groups')
export const Expense = mongoose.model('Expense', expenseSchema, 'expenses')
export const Settlement = mongoose.model('Settlement', settlementSchema, 'settlements')
export const PersonalExpense = mongoose.model('PersonalExpense', personalExpenseSchema, 'personalExpenses')
export const Activity = mongoose.model('Activity', activitySchema, 'activities')

export { Types }
