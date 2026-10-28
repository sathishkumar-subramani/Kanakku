# Kanakku — Android app

Splitwise-style group + personal expense tracker. Expo SDK 58 · expo-router · TypeScript.
Talks to the Kanakku API (Express; see `../docs/API.md`). UI is English only; dark and light themes.

```
mobile/
├── app/                 # expo-router routes (file-based)
│   ├── _layout.tsx      # fonts, providers, auth guard, stack
│   ├── (auth)/          # sign-in, register
│   ├── (tabs)/          # Home · Groups · [+] · Personal · More
│   ├── group/           # new, join, [id] (detail), [id]/settle, [id]/settings
│   ├── expense/         # new (group chooser → form), [id] (detail), [id]/edit
│   ├── personal/        # new, [id] (edit)
│   └── more/            # profile, password, reports
├── src/
│   ├── api/             # axios client + refresh interceptor, typed endpoints, react-query hooks
│   ├── components/      # design-system components (Text, Button, Card, Sheet, charts, forms…)
│   ├── hooks/           # useDownloadReport
│   ├── store/           # zustand auth store + SecureStore token storage
│   ├── theme/           # tokens.json (copied from ../shared/theme.json) + ThemeProvider
│   └── utils/           # money (₹ Indian grouping), dates (YYYY-MM-DD), split maths, files
├── assets/              # icon, adaptive icon, splash
├── app.json · eas.json · tsconfig.json · package.json
```

## 1. Prerequisites

- Node 20+ and npm.
- **Expo Go** on your Android phone (Play Store) — for day-to-day testing.
- The Kanakku API running somewhere reachable (locally on your laptop, or on Render).

No Android Studio is needed for anything below.

## 2. Install

```bash
cd mobile
npm ci        # or: npm install
```

> Always run `npm ci` after unzipping / cloning, **before** `eas build`. A missing `node_modules`
> makes EAS fail with “Failed to resolve plugin for module expo-router”.

## 3. Point the app at your API

The app reads `EXPO_PUBLIC_API_URL`. Paths from `API.md` are relative to it.

| Where the app runs | Value |
|---|---|
| Android emulator | `http://10.0.2.2:5080/api` (the built-in default, nothing to set) |
| Real phone in Expo Go, API on your laptop (same Wi-Fi) | `http://<laptop-ip>:5080/api` → e.g. `http://192.168.1.10:5080/api` |
| APK built with EAS | your Render URL, set in `eas.json` (see §5) |

For Expo Go on a real phone, create a `.env` file (git-ignored) in `mobile/`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:5080/api
```

Find the laptop IP with `ipconfig` (Windows → “IPv4 Address”). The API must listen on
`0.0.0.0:5080` (the Express server already does — `npm run dev` binds to all interfaces), and Windows Firewall must allow port 5080.
Restart `npx expo start` after changing `.env`.

## 4. Run in Expo Go

```bash
npx expo start
```

Scan the QR code with Expo Go (Android: open Expo Go → “Scan QR code”). Press `r` in the terminal to
reload, `m` for the dev menu. If the phone can't connect, try `npx expo start --tunnel`.

Everything in this project works inside Expo Go (no custom native modules).

## 5. Build an APK with EAS (no Android Studio)

One-time:

```bash
npm i -g eas-cli
eas login                 # free Expo account
```

`eas build:configure` has already been done — `eas.json` exists with these profiles:

- `preview` — **APK** for installing on your own phone (use this one)
- `production` — APK as well, same settings
- `development` — dev client (not needed)

`eas.json` already points both profiles at the live API: `https://kanakku-api.onrender.com/api`.
(If you ever move the API, change `EXPO_PUBLIC_API_URL` there and rebuild.)

Then:

```bash
npm ci                                         # make sure node_modules exists
eas build -p android --profile preview
```

The first build asks to generate an Android keystore — answer **Yes** (EAS stores it for you).
The build runs in the cloud (10–20 min). When it finishes, the terminal prints a link; open it on
the phone (or scan the QR), download the `.apk`, and install it (allow “install from unknown
sources” when Android asks). You can also find all builds at <https://expo.dev> → your project → Builds.

To ship an update later: bump `version` in `app.json`, run the same `eas build` command, install
the new APK over the old one (same package name `com.sathish.kanakku`, same keystore).

## 6. Verify locally

```bash
npx tsc --noEmit                   # must be clean
npx expo export --platform web     # proves the bundle compiles
npx expo-doctor                    # dependency/config checks (needs internet)
```

## 7. Notes on behaviour

- **Auth**: tokens live in `expo-secure-store`. A `401` triggers one `/auth/refresh` (single
  in-flight promise shared by concurrent requests), then the request is retried; if the refresh
  fails you land on sign-in.
- **Cold start**: requests time out after 60 s; if a request has been pending for more than
  4 s before the first success, screens show “Waking up the server…” (Render free tier sleeps).
- **Dates**: expense dates are calendar days (`YYYY-MM-DD`) built from local date parts, never
  `toISOString()` — IST midnight stays on the right day.
- **Money**: `Intl.NumberFormat('en-IN')` with a built-in Indian-grouping fallback
  (`₹12,34,567.00`). Balances never show a raw minus sign: “you owe ₹120” / “you are owed ₹400” /
  “settled up”.
- **Splits**: `src/utils/split.ts` mirrors the API’s balance rules — 2-dp rounding, the ±0.01
  remainder goes to the payer’s own split; exact must sum to the amount, percent to 100, shares are
  positive integers. Save is disabled until the split balances.
- **Reports**: PDF/CSV are fetched as bytes, written to the cache directory with
  `expo-file-system` and handed to the Android share sheet with `expo-sharing`.
- **Theme**: System / Light / Dark, persisted in AsyncStorage. All colours come from
  `src/theme/tokens.json` (same file as the web app’s `shared/theme.json`).
