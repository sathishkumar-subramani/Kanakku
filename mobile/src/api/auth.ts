import { request } from './client';
import type {
  AuthResponse,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  TokenPair,
  UpdateMeInput,
  User,
} from './types';

export const authApi = {
  register: (body: RegisterInput) => request<AuthResponse>({ method: 'POST', url: '/auth/register', data: body }),
  login: (body: LoginInput) => request<AuthResponse>({ method: 'POST', url: '/auth/login', data: body }),
  refresh: (refreshToken: string) =>
    request<TokenPair>({ method: 'POST', url: '/auth/refresh', data: { refreshToken } }),
  logout: (refreshToken: string) => request<void>({ method: 'POST', url: '/auth/logout', data: { refreshToken } }),
  me: () => request<User>({ method: 'GET', url: '/auth/me' }),
  updateMe: (body: UpdateMeInput) => request<User>({ method: 'PUT', url: '/auth/me', data: body }),
  changePassword: (body: ChangePasswordInput) => request<void>({ method: 'PUT', url: '/auth/password', data: body }),
};
