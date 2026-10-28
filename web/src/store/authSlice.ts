import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { loadSession, type StoredSession } from '@/api/session'
import type { User } from '@/api/types'

/**
 * The auth slice is a pure mirror of the stored session (localStorage).
 * To change the session, call signIn / signOut / updateSessionUser from api/session.ts —
 * the store subscribes to session changes and updates itself.
 */
interface AuthState {
  user: User | null
  refreshToken: string | null
}

const initialSession = loadSession()

const initialState: AuthState = {
  user: initialSession?.user ?? null,
  refreshToken: initialSession?.refreshToken ?? null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionReplaced(state, action: PayloadAction<StoredSession | null>) {
      state.user = action.payload?.user ?? null
      state.refreshToken = action.payload?.refreshToken ?? null
    },
  },
})

export const { sessionReplaced } = authSlice.actions
export default authSlice.reducer
