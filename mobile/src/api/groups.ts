import { request } from './client';
import type {
  Activity,
  Balances,
  CreateGroupInput,
  Group,
  MonthString,
  UpdateGroupInput,
} from './types';

export const groupsApi = {
  list: (month?: MonthString) => request<Group[]>({ method: 'GET', url: '/groups', params: month ? { month } : undefined }),
  get: (id: string) => request<Group>({ method: 'GET', url: `/groups/${id}` }),
  create: (body: CreateGroupInput) => request<Group>({ method: 'POST', url: '/groups', data: body }),
  update: (id: string, body: UpdateGroupInput) => request<Group>({ method: 'PUT', url: `/groups/${id}`, data: body }),
  remove: (id: string) => request<void>({ method: 'DELETE', url: `/groups/${id}` }),
  join: (inviteCode: string) => request<Group>({ method: 'POST', url: '/groups/join', data: { inviteCode } }),
  regenerateInvite: (id: string) =>
    request<{ inviteCode: string }>({ method: 'POST', url: `/groups/${id}/invite/regenerate` }),
  addMember: (id: string, email: string) =>
    request<Group>({ method: 'POST', url: `/groups/${id}/members`, data: { email } }),
  removeMember: (id: string, userId: string) =>
    request<void>({ method: 'DELETE', url: `/groups/${id}/members/${userId}` }),
  balances: (id: string) => request<Balances>({ method: 'GET', url: `/groups/${id}/balances` }),
  activity: (id: string, limit = 50) =>
    request<Activity[]>({ method: 'GET', url: `/groups/${id}/activity`, params: { limit } }),
};
