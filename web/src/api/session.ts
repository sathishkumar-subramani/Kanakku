import type { AuthResponse, TokenPair, User } from './types'

/**
 * Token storage + the single shared refresh routine.
 * Both RTK Query (baseQuery.ts) and plain downloads (utils/download.ts) go through here,
 * so there is only ever one refresh request in flight.
 */

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || 'http://localhost:5080/api'

const KEY = 'kanakku.session'

export interface StoredSession {
  accessToken: string
  refreshToken: string
  user: User
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSession(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable (private mode) – session lives in memory only */
  }
}

let listeners: Array<(s: StoredSession | null) => void> = []
export function onSessionChange(fn: (s: StoredSession | null) => void) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}

export function getAccessToken() {
  return loadSession()?.accessToken ?? null
}

export function setSession(session: StoredSession | null) {
  saveSession(session)
  listeners.forEach((l) => l(session))
}

/** Called after /auth/login or /auth/register succeeds. */
export function signIn(res: AuthResponse) {
  setSession({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user })
}

export function signOut() {
  setSession(null)
}

/** Keep the cached user (name, colour, currency) in step after a profile update. */
export function updateSessionUser(user: User) {
  const current = loadSession()
  if (current) setSession({ ...current, user })
}

let refreshing: Promise<boolean> | null = null

/** Returns true when a new access token is in place, false when the session is dead. */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    const current = loadSession()
    if (!current) return false
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      })
      if (!res.ok) {
        if (res.status === 401 || res.status === 400) setSession(null)
        return false
      }
      const pair = (await res.json()) as TokenPair
      setSession({ ...current, accessToken: pair.accessToken, refreshToken: pair.refreshToken })
      return true
    } catch {
      return false
    } finally {
      // let the next caller start a fresh refresh if needed
      setTimeout(() => {
        refreshing = null
      }, 0)
    }
  })()
  return refreshing
}
