/**
 * DTOs mirroring docs/API.md exactly.
 *
 * Dates: `date` fields on expenses / settlements / personal expenses are calendar days
 * ("YYYY-MM-DD") in both requests and responses. Audit fields (createdAt, updatedAt,
 * joinedAt, accessTokenExpiresAt) are full ISO-8601 UTC timestamps. `month` params are "YYYY-MM".
 */

import type { Category } from '@/theme';

/** "YYYY-MM-DD" */
export type DayString = string;
/** "YYYY-MM" */
export type MonthString = string;
/** ISO-8601 UTC timestamp */
export type IsoTimestamp = string;

export type { Category };

export type ProblemDetails = {
  status: number;
  title: string;
  detail?: string;
  errors?: Record<string, string[]>;
};

// ---------- Auth ----------

export type User = {
  id: string;
  name: string;
  email: string;
  currency: string;
  avatarColor: string;
  createdAt: IsoTimestamp;
};

export type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: IsoTimestamp;
};

export type TokenPair = { accessToken: string; refreshToken: string };

export type RegisterInput = { name: string; email: string; password: string };
export type LoginInput = { email: string; password: string };
export type UpdateMeInput = { name?: string; currency?: string; avatarColor?: string };
export type ChangePasswordInput = { currentPassword: string; newPassword: string; refreshToken?: string };

// ---------- Users ----------

export type UserLookup = { id: string; name: string; email: string; avatarColor: string };

// ---------- Groups ----------

export type MemberRole = 'owner' | 'member';

export type GroupMember = {
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  role: MemberRole;
  joinedAt: IsoTimestamp;
};

export type Group = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  currency: string;
  inviteCode: string;
  simplifyDebts: boolean;
  createdBy: string;
  createdAt: IsoTimestamp;
  members: GroupMember[];
  /** + = others owe me, − = I owe (in this group) */
  myBalance: number;
  totalSpent: number;
  monthSpent: number;
  lastActivityAt: IsoTimestamp | null;
};

export type CreateGroupInput = { name: string; emoji?: string; color?: string; currency?: string };
export type UpdateGroupInput = { name?: string; emoji?: string; color?: string; simplifyDebts?: boolean };

export type MemberBalance = {
  userId: string;
  name: string;
  avatarColor: string;
  balance: number;
  paid: number;
  share: number;
};

export type Debt = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
};

export type Balances = {
  simplified: boolean;
  members: MemberBalance[];
  debts: Debt[];
};

export type ActivityType =
  | 'expense.added'
  | 'expense.updated'
  | 'expense.deleted'
  | 'settlement.added'
  | 'settlement.deleted'
  | 'member.joined'
  | 'member.left'
  | 'group.updated';

export type Activity = {
  id: string;
  groupId: string;
  actorId: string;
  actorName: string;
  type: ActivityType;
  message: string;
  refId: string | null;
  createdAt: IsoTimestamp;
};

// ---------- Expenses ----------

export type SplitType = 'equal' | 'exact' | 'percent' | 'shares';

export type PersonRef = { id: string; name: string; avatarColor: string };

export type Split = {
  userId: string;
  name: string;
  avatarColor: string;
  amount: number;
  /** what the client sent: ignored for equal, rupees for exact, % for percent, share count for shares */
  value: number;
};

export type Expense = {
  id: string;
  /** "personal" for personal expenses flattened into dashboard.recent */
  groupId: string;
  groupName: string;
  groupEmoji: string;
  description: string;
  amount: number;
  currency: string;
  category: Category;
  date: DayString;
  notes: string | null;
  paidBy: PersonRef;
  splitType: SplitType;
  splits: Split[];
  /** my split amount (0 if not included) */
  myShare: number;
  createdBy: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type SplitInput = { userId: string; value: number };

export type ExpenseInput = {
  description: string;
  amount: number;
  category: Category;
  date: DayString;
  notes?: string;
  paidBy: string;
  splitType: SplitType;
  splits: SplitInput[];
};

export type ExpenseListQuery = {
  month?: MonthString;
  category?: Category;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

// ---------- Settlements ----------

export type Settlement = {
  id: string;
  groupId: string;
  from: PersonRef;
  to: PersonRef;
  amount: number;
  date: DayString;
  note: string | null;
  createdBy: string;
  createdAt: IsoTimestamp;
};

export type SettlementInput = {
  fromUserId: string;
  toUserId: string;
  amount: number;
  date?: DayString;
  note?: string;
};

// ---------- Personal ----------

export type PersonalExpense = {
  id: string;
  description: string;
  amount: number;
  category: Category;
  date: DayString;
  notes: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type PersonalExpenseInput = {
  description: string;
  amount: number;
  category: Category;
  date: DayString;
  notes?: string;
};

// ---------- Dashboard ----------

export type DashboardGroupSlice = {
  /** "personal" for personal expenses */
  groupId: string;
  name: string;
  emoji: string;
  color: string;
  amount: number;
  count: number;
};

export type DashboardCategorySlice = { category: Category; amount: number; count: number };
export type DashboardDay = { date: DayString; amount: number };
export type DashboardGroupBalance = { groupId: string; name: string; emoji: string; color: string; balance: number };

export type Dashboard = {
  month: MonthString;
  totalSpent: number;
  groupShare: number;
  personalSpent: number;
  iPaid: number;
  prevMonthTotal: number;
  youOwe: number;
  youAreOwed: number;
  netBalance: number;
  byGroup: DashboardGroupSlice[];
  byCategory: DashboardCategorySlice[];
  daily: DashboardDay[];
  groupBalances: DashboardGroupBalance[];
  recent: Expense[];
};

// ---------- Reports ----------

export type ReportFormat = 'pdf' | 'csv';

// ---------- Health ----------

export type Health = { status: 'ok'; time: IsoTimestamp };
