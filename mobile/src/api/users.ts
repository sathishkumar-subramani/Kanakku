import { request } from './client';
import type { UserLookup } from './types';

export const usersApi = {
  lookup: (email: string) => request<UserLookup>({ method: 'GET', url: '/users/lookup', params: { email } }),
};
