import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth';
import { authApi } from './auth';
import { dashboardApi } from './dashboard';
import { expensesApi } from './expenses';
import { groupsApi } from './groups';
import { personalApi } from './personal';
import { reportsApi } from './reports';
import { settlementsApi } from './settlements';
import type {
  ChangePasswordInput,
  CreateGroupInput,
  Expense,
  ExpenseInput,
  ExpenseListQuery,
  Group,
  MonthString,
  PersonalExpenseInput,
  SettlementInput,
  UpdateGroupInput,
  UpdateMeInput,
  User,
} from './types';
import { usersApi } from './users';
import { tokenStorage } from '@/store/tokenStorage';

// ---------- Query keys ----------
export const qk = {
  me: ['me'] as const,
  dashboard: (month: MonthString) => ['dashboard', month] as const,
  groups: ['groups'] as const,
  group: (id: string) => ['groups', id] as const,
  balances: (id: string) => ['groups', id, 'balances'] as const,
  activity: (id: string) => ['groups', id, 'activity'] as const,
  settlements: (id: string) => ['groups', id, 'settlements'] as const,
  expenses: (id: string, q: ExpenseListQuery) => ['groups', id, 'expenses', q] as const,
  expense: (id: string) => ['expenses', id] as const,
  recent: ['expenses', 'recent'] as const,
  personal: (month?: MonthString) => ['personal', month ?? 'all'] as const,
  reportMonths: ['reports', 'months'] as const,
  lookup: (email: string) => ['users', 'lookup', email] as const,
};

function useSignedIn() {
  return useAuthStore((s) => s.status === 'signedIn');
}

// ---------- Me ----------
export function useMe(options?: Partial<UseQueryOptions<User>>) {
  const enabled = useSignedIn();
  const setUser = useAuthStore((s) => s.setUser);
  const q = useQuery<User>({
    queryKey: qk.me,
    queryFn: async () => {
      const u = await authApi.me();
      setUser(u);
      return u;
    },
    enabled,
    staleTime: 5 * 60_000,
    ...options,
  });
  return q;
}

export function useUpdateMe() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (body: UpdateMeInput) => authApi.updateMe(body),
    onSuccess: (u) => {
      setUser(u);
      qc.setQueryData(qk.me, u);
      // currency may change amounts' display everywhere
      qc.invalidateQueries();
    },
  });
}

export function useChangePassword() {
  // Send this device's refresh token so it stays signed in while every other device is signed out.
  return useMutation({
    mutationFn: async (body: ChangePasswordInput) => {
      const tokens = await tokenStorage.load();
      return authApi.changePassword({ ...body, refreshToken: tokens?.refreshToken });
    },
  });
}

// ---------- Dashboard ----------
export function useDashboard(month: MonthString) {
  const enabled = useSignedIn();
  return useQuery({ queryKey: qk.dashboard(month), queryFn: () => dashboardApi.get(month), enabled });
}

// ---------- Groups ----------
export function useGroups() {
  const enabled = useSignedIn();
  return useQuery({ queryKey: qk.groups, queryFn: () => groupsApi.list(), enabled });
}

export function useGroup(id: string | undefined) {
  const enabled = useSignedIn() && !!id;
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.group(id ?? ''),
    queryFn: () => groupsApi.get(id ?? ''),
    enabled,
    initialData: () => qc.getQueryData<Group[]>(qk.groups)?.find((g) => g.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(qk.groups)?.dataUpdatedAt,
  });
}

export function useBalances(groupId: string | undefined) {
  const enabled = useSignedIn() && !!groupId;
  return useQuery({ queryKey: qk.balances(groupId ?? ''), queryFn: () => groupsApi.balances(groupId ?? ''), enabled });
}

export function useActivity(groupId: string | undefined) {
  const enabled = useSignedIn() && !!groupId;
  return useQuery({ queryKey: qk.activity(groupId ?? ''), queryFn: () => groupsApi.activity(groupId ?? ''), enabled });
}

function invalidateGroup(qc: ReturnType<typeof useQueryClient>, groupId: string) {
  qc.invalidateQueries({ queryKey: qk.groups });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
  qc.invalidateQueries({ queryKey: qk.recent });
  qc.invalidateQueries({ queryKey: ['groups', groupId] });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGroupInput) => groupsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groups }),
  });
}

export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => groupsApi.join(code.trim().toUpperCase()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.groups });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateGroupInput) => groupsApi.update(groupId, body),
    onSuccess: (g) => {
      qc.setQueryData(qk.group(groupId), g);
      invalidateGroup(qc, groupId);
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => groupsApi.remove(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.groups });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: qk.recent });
    },
  });
}

export function useRegenerateInvite(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => groupsApi.regenerateInvite(groupId),
    onSuccess: ({ inviteCode }) => {
      qc.setQueryData<Group | undefined>(qk.group(groupId), (g) => (g ? { ...g, inviteCode } : g));
      qc.invalidateQueries({ queryKey: qk.group(groupId) });
    },
  });
}

export function useAddMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => groupsApi.addMember(groupId, email.trim()),
    onSuccess: () => invalidateGroup(qc, groupId),
  });
}

export function useRemoveMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => groupsApi.removeMember(groupId, userId),
    onSuccess: () => invalidateGroup(qc, groupId),
  });
}

export function useLookupUser(email: string) {
  const enabled = useSignedIn() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return useQuery({
    queryKey: qk.lookup(email.trim().toLowerCase()),
    queryFn: () => usersApi.lookup(email.trim()),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

// ---------- Expenses ----------
export function useGroupExpenses(groupId: string | undefined, query: ExpenseListQuery) {
  const enabled = useSignedIn() && !!groupId;
  return useQuery({
    queryKey: qk.expenses(groupId ?? '', query),
    queryFn: () => expensesApi.list(groupId ?? '', query),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useExpense(id: string | undefined) {
  const enabled = useSignedIn() && !!id;
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.expense(id ?? ''),
    queryFn: () => expensesApi.get(id ?? ''),
    enabled,
    initialData: () => {
      // Seed from any cached expense list (group lists, dashboard.recent) so the sheet opens instantly.
      const isExpense = (x: unknown): x is Expense =>
        typeof x === 'object' && x !== null && 'splits' in x && 'paidBy' in x && (x as { id?: unknown }).id === id;
      for (const [, data] of qc.getQueriesData<unknown>({ queryKey: ['groups'] })) {
        const items = Array.isArray(data) ? data : (data as { items?: unknown[] } | undefined)?.items;
        const hit = items?.find(isExpense);
        if (hit) return hit;
      }
      for (const [, data] of qc.getQueriesData<{ recent?: unknown[] }>({ queryKey: ['dashboard'] })) {
        const hit = data?.recent?.find(isExpense);
        if (hit) return hit;
      }
      return undefined;
    },
    // Seeded data is a snapshot; always confirm with the server.
    initialDataUpdatedAt: 0,
  });
}

export function useRecentExpenses() {
  const enabled = useSignedIn();
  return useQuery({ queryKey: qk.recent, queryFn: () => expensesApi.recent(20), enabled });
}

export function useCreateExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ExpenseInput) => expensesApi.create(groupId, body),
    onSuccess: () => invalidateGroup(qc, groupId),
  });
}

export function useUpdateExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ExpenseInput }) => expensesApi.update(id, body),
    onSuccess: (e) => {
      qc.setQueryData(qk.expense(e.id), e);
      invalidateGroup(qc, groupId);
    },
  });
}

export function useDeleteExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => invalidateGroup(qc, groupId),
  });
}

// ---------- Settlements ----------
export function useSettlements(groupId: string | undefined) {
  const enabled = useSignedIn() && !!groupId;
  return useQuery({
    queryKey: qk.settlements(groupId ?? ''),
    queryFn: () => settlementsApi.list(groupId ?? ''),
    enabled,
  });
}

export function useCreateSettlement(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SettlementInput) => settlementsApi.create(groupId, body),
    onSuccess: () => invalidateGroup(qc, groupId),
  });
}

export function useDeleteSettlement(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settlementsApi.remove(id),
    onSuccess: () => invalidateGroup(qc, groupId),
  });
}

// ---------- Personal ----------
export function usePersonal(month?: MonthString) {
  const enabled = useSignedIn();
  return useQuery({ queryKey: qk.personal(month), queryFn: () => personalApi.list(month), enabled });
}

function invalidatePersonal(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['personal'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
  qc.invalidateQueries({ queryKey: qk.recent });
}

export function useCreatePersonal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PersonalExpenseInput) => personalApi.create(body),
    onSuccess: () => invalidatePersonal(qc),
  });
}

export function useUpdatePersonal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PersonalExpenseInput }) => personalApi.update(id, body),
    onSuccess: () => invalidatePersonal(qc),
  });
}

export function useDeletePersonal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => personalApi.remove(id),
    onSuccess: () => invalidatePersonal(qc),
  });
}

// ---------- Reports ----------
export function useReportMonths() {
  const enabled = useSignedIn();
  return useQuery({ queryKey: qk.reportMonths, queryFn: () => reportsApi.months(), enabled });
}
