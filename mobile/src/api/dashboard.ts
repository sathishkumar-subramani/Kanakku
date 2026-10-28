import { request } from './client';
import type { Dashboard, MonthString } from './types';

export const dashboardApi = {
  get: (month: MonthString) => request<Dashboard>({ method: 'GET', url: '/dashboard', params: { month } }),
};
