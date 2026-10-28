import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux'
import { kanakkuApi } from '@/api/kanakkuApi'
import { onSessionChange } from '@/api/session'
import authReducer, { sessionReplaced } from './authSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [kanakkuApi.reducerPath]: kanakkuApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(kanakkuApi.middleware),
})

// The session (localStorage) is the source of truth; the slice mirrors it.
// Runs for sign-in, sign-out, profile updates and token refreshes (which may happen outside React).
onSessionChange((session) => {
  const wasSignedIn = !!store.getState().auth.user
  store.dispatch(sessionReplaced(session))
  if (!session && wasSignedIn) store.dispatch(kanakkuApi.util.resetApiState())
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
