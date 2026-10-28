/**
 * API base URL.
 *
 * - Android emulator:   http://10.0.2.2:5080/api   (default)
 * - Real phone (Expo Go over Wi-Fi): put `EXPO_PUBLIC_API_URL=http://<laptop-ip>:5080/api` in `.env`
 * - EAS APK build:      set EXPO_PUBLIC_API_URL in eas.json (Render URL)
 */
const DEFAULT_API_URL = 'http://10.0.2.2:5080/api';

export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');

/** 60 s — Render free tier cold start can take 30–60 s. */
export const REQUEST_TIMEOUT_MS = 60_000;

/** After this long on a pending request we show "Waking up the server…". */
export const WAKE_HINT_AFTER_MS = 4_000;
