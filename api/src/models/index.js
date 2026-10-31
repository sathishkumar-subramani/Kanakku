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
    sourceRef: { type: String, default: null }, // capture key ("ref:<UPI RRN>" …) when added from a bank SMS / payment notification
  },
  opts(),
)
expenseSchema.index({ groupId: 1, date: -1 })
expenseSchema.index({ sourceRef: 1 }, { partialFilterExpression: { sourceRef: { $type: 'string' } } })

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
    sourceRef: { type: String, default: null },
  },
  opts(),
)
settlementSchema.index({ groupId: 1, date: -1 })
settlementSchema.index({ sourceRef: 1 }, { partialFilterExpression: { sourceRef: { $type: 'string' } } })

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
    sourceRef: { type: String, default: null },
  },
  opts(),
)
personalExpenseSchema.index({ userId: 1, date: -1 })
personalExpenseSchema.index({ userId: 1, sourceRef: 1 }, { partialFilterExpression: { sourceRef: { $type: 'string' } } })

// ---------- payment capture ----------

// "When I pay <payee>, file it like this" — learned on the phone from the user's own choices.
const captureRuleSchema = new Schema(
  {
    userId: { type: ObjectId, required: true },
    key: { type: String, required: true }, // lower-cased VPA, or "name:<normalised payee name>"
    label: { type: String, default: '' },
    kind: { type: String, enum: ['personal', 'group', 'settlement', 'ignore'], required: true },
    groupId: { type: ObjectId, default: null },
    category: { type: String, default: null },
    description: { type: String, default: null },
    splitWith: { type: [ObjectId], default: [] }, // empty = everyone in the group
    counterpartyUserId: { type: ObjectId, default: null }, // settlements: the roommate on the other side
    autoSave: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  opts(),
)
captureRuleSchema.index({ userId: 1, key: 1 }, { unique: true })

// "Teach once" hints for bank SMS formats the generic parser can't read. Shared by everyone, and
// they hold only the few words around the amount / payee — never amounts, names or account numbers.
const smsTemplateSchema = new Schema(
  {
    senderKey: { type: String, required: true },
    direction: { type: String, enum: ['debit', 'credit'], required: true },
    amountBefore: { type: String, required: true },
    payeeBefore: { type: String, default: null },
    payeeAfter: { type: String, default: null },
    uses: { type: Number, default: 1 },
    createdBy: { type: ObjectId, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  opts(),
)
smsTemplateSchema.index({ senderKey: 1, direction: 1, amountBefore: 1, payeeBefore: 1, payeeAfter: 1 }, { unique: true })
smsTemplateSchema.index({ uses: -1 })

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
export const CaptureRule = mongoose.model('CaptureRule', captureRuleSchema, 'captureRules')
export const SmsTemplate = mongoose.model('SmsTemplate', smsTemplateSchema, 'smsTemplates')

export { Types }
