import { request } from './client';
import type { Expense, ExpenseInput, ExpenseListQuery, Paged } from './types';

export const expensesApi = {
  list: (groupId: string, query: ExpenseListQuery = {}) =>
    request<Paged<Expense>>({
      method: 'GET',
      url: `/groups/${groupId}/expenses`,
      params: {
        month: query.month,
        category: query.category,
        search: query.search || undefined,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 50,
      },
    }),
  create: (groupId: string, body: ExpenseInput) =>
    request<Expense>({ method: 'POST', url: `/groups/${groupId}/expenses`, data: body }),
  get: (id: string) => request<Expense>({ method: 'GET', url: `/expenses/${id}` }),
  update: (id: string, body: ExpenseInput) => request<Expense>({ method: 'PUT', url: `/expenses/${id}`, data: body }),
  remove: (id: string) => request<void>({ method: 'DELETE', url: `/expenses/${id}` }),
  recent: (limit = 20) => request<Expense[]>({ method: 'GET', url: '/expenses/recent', params: { limit } }),
};
