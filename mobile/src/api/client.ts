import axios, { AxiosError, AxiosHeaders, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '@/store/auth';
import { API_URL, REQUEST_TIMEOUT_MS, WAKE_HINT_AFTER_MS } from './config';
import type { ProblemDetails, TokenPair } from './types';

export const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

/** Bare client without interceptors, used for /auth/refresh so a 401 there can't loop. */
const bare = axios.create({ baseURL: API_URL, timeout: REQUEST_TIMEOUT_MS });

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean; _wakeTimer?: ReturnType<typeof setTimeout> };

// ---- "Waking up the server…" hint ----
let pendingCount = 0;
let everSucceeded = false;

function startWakeTimer(config: RetryableConfig) {
  if (everSucceeded) return;
  pendingCount += 1;
  config._wakeTimer = setTimeout(() => {
    if (!everSucceeded) useAuthStore.getState().setWakingUp(true);
  }, WAKE_HINT_AFTER_MS);
}

function stopWakeTimer(config: RetryableConfig | undefined, ok: boolean) {
  if (!config?._wakeTimer) return;
  clearTimeout(config._wakeTimer);
  config._wakeTimer = undefined;
  pendingCount = Math.max(0, pendingCount - 1);
  if (ok) everSucceeded = true;
  if (ok || pendingCount === 0) useAuthStore.getState().setWakingUp(false);
}

// ---- Request: attach bearer token ----
api.interceptors.request.use((config) => {
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.accessToken) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    config.headers = headers;
  }
  startWakeTimer(config as RetryableConfig);
  return config;
});

// ---- Response: single in-flight refresh on 401, then retry once ----
let refreshPromise: Promise<TokenPair> | null = null;

async function refreshTokens(): Promise<TokenPair> {
  if (!refreshPromise) {
    const current = useAuthStore.getState().tokens;
    if (!current?.refreshToken) {
      refreshPromise = Promise.reject(new Error('No refresh token'));
    } else {
      refreshPromise = bare
        .post<TokenPair>('/auth/refresh', { refreshToken: current.refreshToken })
        .then(async (res) => {
          await useAuthStore.getState().setTokens(res.data);
          return res.data;
        });
    }
    refreshPromise.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => {
    stopWakeTimer(response.config as RetryableConfig, true);
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    stopWakeTimer(config, false);

    if (error.response?.status === 401 && config && !config._retried) {
      config._retried = true;
      try {
        const fresh = await refreshTokens();
        const headers = AxiosHeaders.from(config.headers);
        headers.set('Authorization', `Bearer ${fresh.accessToken}`);
        config.headers = headers;
        return api.request(config);
      } catch {
        await useAuthStore.getState().signOut();
      }
    }
    return Promise.reject(error);
  },
);

// ---- Error helpers ----

export class ApiError extends Error {
  status: number;
  title: string;
  detail?: string;
  errors?: Record<string, string[]>;
  constructor(status: number, problem: Partial<ProblemDetails> | undefined, fallback: string) {
    const detail = problem?.detail ?? firstFieldError(problem?.errors) ?? problem?.title ?? fallback;
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.title = problem?.title ?? fallback;
    this.detail = problem?.detail;
    this.errors = problem?.errors;
  }
}

function firstFieldError(errors?: Record<string, string[]>): string | undefined {
  if (!errors) return undefined;
  for (const key of Object.keys(errors)) {
    const list = errors[key];
    if (list && list.length > 0) return list[0];
  }
  return undefined;
}

function isProblem(data: unknown): data is Partial<ProblemDetails> {
  return typeof data === 'object' && data !== null && ('title' in data || 'detail' in data || 'errors' in data);
}

/** Turn any thrown value into a friendly sentence for the UI. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return new ApiError(0, undefined, 'The server took too long to answer. Please try again.');
    }
    if (!err.response) {
      return new ApiError(0, undefined, "Couldn't reach the server. Check your connection and the API URL.");
    }
    const status = err.response.status;
    const data: unknown = err.response.data;
    const problem = isProblem(data) ? data : undefined;
    const fallback =
      status === 401
        ? 'Please sign in again.'
        : status === 403
          ? "You don't have access to that."
          : status === 404
            ? "We couldn't find that."
            : status === 409
              ? 'That conflicts with something that already exists.'
              : status >= 500
                ? 'The server hit a problem. Please try again.'
                : 'Something went wrong.';
    return new ApiError(status, problem, fallback);
  }
  if (err instanceof Error) return new ApiError(0, undefined, err.message);
  return new ApiError(0, undefined, 'Something went wrong.');
}

export function errorMessage(err: unknown): string {
  return toApiError(err).message;
}

/** Typed request helper: unwraps data and normalises errors. */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const res = await api.request<T>(config);
    return res.data;
  } catch (err) {
    throw toApiError(err);
  }
}
