import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithReauth } from './baseQuery'
import type {
  Activity,
  AuthResponse,
  Balances,
  Dashboard,
  Expense,
  ExpenseInput,
  Group,
  Paged,
  Person,
  PersonalExpense,
  PersonalExpenseInput,
  Settlement,
  SettlementInput,
  User,
} from './types'

export const kanakkuApi = createApi({
  reducerPath: 'kanakkuApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Me', 'Groups', 'Group', 'Expenses', 'Expense', 'Balances', 'Settlements', 'Activity', 'Personal', 'Dashboard', 'Reports', 'Recent'],
  endpoints: (build) => ({
    // ----- auth -----
    login: build.mutation<AuthResponse, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    register: build.mutation<AuthResponse, { name: string; email: string; password: string }>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    logout: build.mutation<void, { refreshToken: string }>({
      query: (body) => ({ url: '/auth/logout', method: 'POST', body }),
    }),
    me: build.query<User, void>({
      query: () => '/auth/me',
      providesTags: ['Me'],
    }),
    updateMe: build.mutation<User, { name?: string; currency?: string; avatarColor?: string }>({
      query: (body) => ({ url: '/auth/me', method: 'PUT', body }),
      invalidatesTags: ['Me', 'Dashboard', 'Groups'],
    }),
    changePassword: build.mutation<void, { currentPassword: string; newPassword: string; refreshToken?: string }>({
      query: (body) => ({ url: '/auth/password', method: 'PUT', body }),
    }),
    lookupUser: build.query<Person & { email: string }, string>({
      query: (email) => ({ url: '/users/lookup', params: { email } }),
    }),

    // ----- groups -----
    groups: build.query<Group[], { month?: string } | void>({
      query: (arg) => ({ url: '/groups', params: arg && arg.month ? { month: arg.month } : undefined }),
      providesTags: (result) => [
        'Groups',
        ...(result ?? []).map((g) => ({ type: 'Group' as const, id: g.id })),
      ],
    }),
    group: build.query<Group, string>({
      query: (id) => `/groups/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Group', id }],
    }),
    createGroup: build.mutation<Group, { name: string; emoji?: string; color?: string; currency?: string }>({
      query: (body) => ({ url: '/groups', method: 'POST', body }),
      invalidatesTags: ['Groups', 'Dashboard', 'Reports'],
    }),
    updateGroup: build.mutation<Group, { id: string; name?: string; emoji?: string; color?: string; simplifyDebts?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/groups/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => ['Groups', { type: 'Group', id }, { type: 'Balances', id }, { type: 'Activity', id }, 'Dashboard'],
    }),
    deleteGroup: build.mutation<void, string>({
      query: (id) => ({ url: `/groups/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Groups', 'Dashboard', 'Reports', 'Recent'],
    }),
    joinGroup: build.mutation<Group, { inviteCode: string }>({
      query: (body) => ({ url: '/groups/join', method: 'POST', body }),
      invalidatesTags: ['Groups', 'Dashboard'],
    }),
    regenerateInvite: build.mutation<{ inviteCode: string }, string>({
      query: (id) => ({ url: `/groups/${id}/invite/regenerate`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Group', id }, 'Groups'],
    }),
    addMember: build.mutation<Group, { id: string; email: string }>({
      query: ({ id, email }) => ({ url: `/groups/${id}/members`, method: 'POST', body: { email } }),
      invalidatesTags: (_r, _e, { id }) => ['Groups', { type: 'Group', id }, { type: 'Balances', id }, { type: 'Activity', id }],
    }),
    removeMember: build.mutation<void, { id: string; userId: string }>({
      query: ({ id, userId }) => ({ url: `/groups/${id}/members/${userId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { id }) => ['Groups', { type: 'Group', id }, { type: 'Balances', id }, { type: 'Activity', id }, 'Dashboard'],
    }),
    balances: build.query<Balances, string>({
      query: (id) => `/groups/${id}/balances`,
      providesTags: (_r, _e, id) => [{ type: 'Balances', id }],
    }),
    activity: build.query<Activity[], { id: string; limit?: number }>({
      query: ({ id, limit = 50 }) => ({ url: `/groups/${id}/activity`, params: { limit } }),
      providesTags: (_r, _e, { id }) => [{ type: 'Activity', id }],
    }),

    // ----- expenses -----
    expenses: build.query<Paged<Expense>, { groupId: string; month?: string; category?: string; search?: string; page?: number; pageSize?: number }>({
      query: ({ groupId, ...params }) => ({ url: `/groups/${groupId}/expenses`, params }),
      providesTags: (_r, _e, { groupId }) => [{ type: 'Expenses', id: groupId }],
    }),
    expense: build.query<Expense, string>({
      query: (id) => `/expenses/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Expense', id }],
    }),
    recentExpenses: build.query<Expense[], number | void>({
      query: (limit) => ({ url: '/expenses/recent', params: { limit: limit ?? 20 } }),
      providesTags: ['Recent'],
    }),
    createExpense: build.mutation<Expense, { groupId: string; input: ExpenseInput }>({
      query: ({ groupId, input }) => ({ url: `/groups/${groupId}/expenses`, method: 'POST', body: input }),
      invalidatesTags: (_r, _e, { groupId }) => [
        'Groups', 'Dashboard', 'Reports', 'Recent',
        { type: 'Group', id: groupId }, { type: 'Expenses', id: groupId }, { type: 'Balances', id: groupId }, { type: 'Activity', id: groupId },
      ],
    }),
    updateExpense: build.mutation<Expense, { id: string; groupId: string; input: ExpenseInput }>({
      query: ({ id, input }) => ({ url: `/expenses/${id}`, method: 'PUT', body: input }),
      invalidatesTags: (_r, _e, { id, groupId }) => [
        'Groups', 'Dashboard', 'Reports', 'Recent', { type: 'Expense', id },
        { type: 'Group', id: groupId }, { type: 'Expenses', id: groupId }, { type: 'Balances', id: groupId }, { type: 'Activity', id: groupId },
      ],
    }),
    deleteExpense: build.mutation<void, { id: string; groupId: string }>({
      query: ({ id }) => ({ url: `/expenses/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { id, groupId }) => [
        'Groups', 'Dashboard', 'Reports', 'Recent', { type: 'Expense', id },
        { type: 'Group', id: groupId }, { type: 'Expenses', id: groupId }, { type: 'Balances', id: groupId }, { type: 'Activity', id: groupId },
      ],
    }),

    // ----- settlements -----
    settlements: build.query<Settlement[], string>({
      query: (groupId) => `/groups/${groupId}/settlements`,
      providesTags: (_r, _e, id) => [{ type: 'Settlements', id }],
    }),
    createSettlement: build.mutation<Settlement, { groupId: string; input: SettlementInput }>({
      query: ({ groupId, input }) => ({ url: `/groups/${groupId}/settlements`, method: 'POST', body: input }),
      invalidatesTags: (_r, _e, { groupId }) => [
        'Groups', 'Dashboard', 'Reports',
        { type: 'Group', id: groupId }, { type: 'Settlements', id: groupId }, { type: 'Balances', id: groupId }, { type: 'Activity', id: groupId },
      ],
    }),
    deleteSettlement: build.mutation<void, { id: string; groupId: string }>({
      query: ({ id }) => ({ url: `/settlements/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { groupId }) => [
        'Groups', 'Dashboard', 'Reports',
        { type: 'Group', id: groupId }, { type: 'Settlements', id: groupId }, { type: 'Balances', id: groupId }, { type: 'Activity', id: groupId },
      ],
    }),

    // ----- personal -----
    personal: build.query<PersonalExpense[], { month?: string } | void>({
      query: (arg) => ({ url: '/personal', params: arg && arg.month ? { month: arg.month } : undefined }),
      providesTags: ['Personal'],
    }),
    createPersonal: build.mutation<PersonalExpense, PersonalExpenseInput>({
      query: (body) => ({ url: '/personal', method: 'POST', body }),
      invalidatesTags: ['Personal', 'Dashboard', 'Reports'],
    }),
    updatePersonal: build.mutation<PersonalExpense, { id: string; input: PersonalExpenseInput }>({
      query: ({ id, input }) => ({ url: `/personal/${id}`, method: 'PUT', body: input }),
      invalidatesTags: ['Personal', 'Dashboard', 'Reports'],
    }),
    deletePersonal: build.mutation<void, string>({
      query: (id) => ({ url: `/personal/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Personal', 'Dashboard', 'Reports'],
    }),

    // ----- dashboard & reports -----
    dashboard: build.query<Dashboard, string | void>({
      query: (month) => ({ url: '/dashboard', params: month ? { month } : undefined }),
      providesTags: ['Dashboard'],
    }),
    reportMonths: build.query<string[], void>({
      query: () => '/reports/months',
      providesTags: ['Reports'],
    }),
  }),
})

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useMeQuery,
  useUpdateMeMutation,
  useChangePasswordMutation,
  useLazyLookupUserQuery,
  useGroupsQuery,
  useGroupQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useJoinGroupMutation,
  useRegenerateInviteMutation,
  useAddMemberMutation,
  useRemoveMemberMutation,
  useBalancesQuery,
  useActivityQuery,
  useExpensesQuery,
  useExpenseQuery,
  useRecentExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useSettlementsQuery,
  useCreateSettlementMutation,
  useDeleteSettlementMutation,
  usePersonalQuery,
  useCreatePersonalMutation,
  useUpdatePersonalMutation,
  useDeletePersonalMutation,
  useDashboardQuery,
  useReportMonthsQuery,
} = kanakkuApi
