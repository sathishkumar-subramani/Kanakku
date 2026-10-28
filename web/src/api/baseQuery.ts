import { fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import { API_URL, getAccessToken, refreshSession, setSession } from './session'
import type { ApiProblem } from './types'

const raw = fetchBaseQuery({
  baseUrl: API_URL,
  // Render's free tier sleeps; the first request after idle can take ~30-60 s.
  timeout: 60_000,
  prepareHeaders: (headers) => {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  let result = await raw(args, api, extra)
  const url = typeof args === 'string' ? args : args.url
  const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/register') || url.startsWith('/auth/refresh')

  if (result.error && result.error.status === 401 && !isAuthCall) {
    const ok = await refreshSession()
    if (ok) {
      result = await raw(args, api, extra)
    } else {
      setSession(null)
    }
  }
  return result
}

/** Turns any RTK Query error into one readable sentence. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err || typeof err !== 'object') return fallback
  const e = err as FetchBaseQueryError & { data?: unknown; error?: string }
  if (e.status === 'TIMEOUT_ERROR') return 'The server took too long to answer. If it was asleep, try again in a few seconds.'
  if (e.status === 'FETCH_ERROR') return 'Could not reach the server. Check your connection and the API URL.'
  const data = e.data as Partial<ApiProblem> | undefined
  if (data && typeof data === 'object') {
    if (typeof data.detail === 'string' && data.detail) return data.detail
    if (data.errors) {
      const first = Object.values(data.errors).flat()[0]
      if (first) return first
    }
    if (typeof data.title === 'string' && data.title) return data.title
  }
  if (e.status === 401) return 'Please sign in again.'
  if (e.status === 403) return "You don't have access to that."
  if (e.status === 404) return 'Not found.'
  return fallback
}
