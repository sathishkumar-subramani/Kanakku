import { request } from './client';
import type { MonthString, PersonalExpense, PersonalExpenseInput } from './types';

export const personalApi = {
  list: (month?: MonthString) =>
    request<PersonalExpense[]>({ method: 'GET', url: '/personal', params: month ? { month } : undefined }),
  create: (body: PersonalExpenseInput) => request<PersonalExpense>({ method: 'POST', url: '/personal', data: body }),
  update: (id: string, body: PersonalExpenseInput) =>
    request<PersonalExpense>({ method: 'PUT', url: `/personal/${id}`, data: body }),
  remove: (id: string) => request<void>({ method: 'DELETE', url: `/personal/${id}` }),
};
