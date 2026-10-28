import { request } from './client';
import type { Settlement, SettlementInput } from './types';

export const settlementsApi = {
  list: (groupId: string) => request<Settlement[]>({ method: 'GET', url: `/groups/${groupId}/settlements` }),
  create: (groupId: string, body: SettlementInput) =>
    request<Settlement>({ method: 'POST', url: `/groups/${groupId}/settlements`, data: body }),
  remove: (id: string) => request<void>({ method: 'DELETE', url: `/settlements/${id}` }),
};
