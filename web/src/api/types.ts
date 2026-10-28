// Mirrors docs/API.md exactly.

export type Category =
  | 'food'
  | 'groceries'
  | 'rent'
  | 'utilities'
  | 'travel'
  | 'entertainment'
  | 'shopping'
  | 'health'
  | 'household'
  | 'other'

export type SplitType = 'equal' | 'exact' | 'percent' | 'shares'

export interface Person {
  id: string
  name: string
  avatarColor: string
}

export interface User {
  id: string
  name: string
  email: string
  currency: string
  avatarColor: string
  createdAt: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
}

export interface GroupMember {
  userId: string
  name: string
  email: string
  avatarColor: string
  role: 'owner' | 'member'
  joinedAt: string
}

export interface Group {
  id: string
  name: string
  emoji: string
  color: string
  currency: string
  inviteCode: string
  simplifyDebts: boolean
  createdBy: string
  createdAt: string
  members: GroupMember[]
  myBalance: number
  totalSpent: number
  monthSpent: number
  lastActivityAt: string
}

export interface MemberBalance {
  userId: string
  name: string
  avatarColor: string
  balance: number
  paid: number
  share: number
}

export interface Debt {
  fromUserId: string
  fromName: string
  toUserId: string
  toName: string
  amount: number
}

export interface Balances {
  simplified: boolean
  members: MemberBalance[]
  debts: Debt[]
}

export interface Activity {
  id: string
  groupId: string
  actorId: string
  actorName: string
  type: string
  message: string
  refId: string | null
  createdAt: string
}

export interface Split {
  userId: string
  name: string
  avatarColor: string
  amount: number
  value: number
}

export interface Expense {
  id: string
  groupId: string
  groupName: string
  groupEmoji: string
  description: string
  amount: number
  currency: string
  category: Category
  date: string // YYYY-MM-DD
  notes: string | null
  paidBy: Person
  splitType: SplitType
  splits: Split[]
  myShare: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ExpenseInput {
  description: string
  amount: number
  category: Category
  date: string
  notes?: string
  paidBy: string
  splitType: SplitType
  splits: { userId: string; value: number }[]
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface Settlement {
  id: string
  groupId: string
  from: Person
  to: Person
  amount: number
  date: string
  note: string | null
  createdBy: string
  createdAt: string
}

export interface SettlementInput {
  fromUserId: string
  toUserId: string
  amount: number
  date?: string
  note?: string
}

export interface PersonalExpense {
  id: string
  description: string
  amount: number
  category: Category
  date: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PersonalExpenseInput {
  description: string
  amount: number
  category: Category
  date: string
  notes?: string
}

export interface GroupSpend {
  groupId: string
  name: string
  emoji: string
  color: string
  amount: number
  count: number
}

export interface CategorySpend {
  category: Category
  amount: number
  count: number
}

export interface DailySpend {
  date: string
  amount: number
}

export interface GroupBalance {
  groupId: string
  name: string
  emoji: string
  color: string
  balance: number
}

export interface Dashboard {
  month: string
  totalSpent: number
  groupShare: number
  personalSpent: number
  iPaid: number
  prevMonthTotal: number
  youOwe: number
  youAreOwed: number
  netBalance: number
  byGroup: GroupSpend[]
  byCategory: CategorySpend[]
  daily: DailySpend[]
  groupBalances: GroupBalance[]
  recent: Expense[]
}

export interface ApiProblem {
  status: number
  title: string
  detail: string
  errors?: Record<string, string[]> | null
}
