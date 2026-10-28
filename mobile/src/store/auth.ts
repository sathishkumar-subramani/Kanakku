import { create } from 'zustand';

import type { TokenPair, User } from '@/api/types';
import { tokenStorage } from './tokenStorage';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  user: User | null;
  tokens: TokenPair | null;
  /** True while a request has been pending > 4 s during the first load (Render cold start). */
  wakingUp: boolean;
  setWakingUp: (v: boolean) => void;
  hydrate: () => Promise<void>;
  signIn: (user: User, tokens: TokenPair) => Promise<void>;
  setTokens: (tokens: TokenPair) => Promise<void>;
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  tokens: null,
  wakingUp: false,
  setWakingUp: (v) => set({ wakingUp: v }),

  hydrate: async () => {
    const tokens = await tokenStorage.load();
    if (!tokens) {
      set({ status: 'signedOut', tokens: null, user: null });
      return;
    }
    // Mark as signedIn with the stored tokens; the /auth/me query fills `user`.
    set({ status: 'signedIn', tokens });
  },

  signIn: async (user, tokens) => {
    await tokenStorage.save(tokens);
    set({ status: 'signedIn', user, tokens });
  },

  setTokens: async (tokens) => {
    await tokenStorage.save(tokens);
    set({ tokens });
  },

  setUser: (user) => set({ user }),

  signOut: async () => {
    if (get().status === 'signedOut') return;
    await tokenStorage.clear();
    set({ status: 'signedOut', user: null, tokens: null });
  },
}));
