import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { TokenPair } from '@/api/types';

const ACCESS_KEY = 'kanakku.accessToken';
const REFRESH_KEY = 'kanakku.refreshToken';

// SecureStore is native-only; on web (used only for the bundle check) fall back to localStorage.
const webStore = {
  get(key: string): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  remove(key: string) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return webStore.get(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') return webStore.set(key, value);
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') return webStore.remove(key);
  await SecureStore.deleteItemAsync(key);
}

export const tokenStorage = {
  async load(): Promise<TokenPair | null> {
    const [accessToken, refreshToken] = await Promise.all([getItem(ACCESS_KEY), getItem(REFRESH_KEY)]);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  },
  async save(tokens: TokenPair): Promise<void> {
    await Promise.all([setItem(ACCESS_KEY, tokens.accessToken), setItem(REFRESH_KEY, tokens.refreshToken)]);
  },
  async clear(): Promise<void> {
    await Promise.all([removeItem(ACCESS_KEY), removeItem(REFRESH_KEY)]);
  },
};
