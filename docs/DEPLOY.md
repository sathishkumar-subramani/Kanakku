# Deploying Kanakku

Three pieces, three free tiers:

| Piece | Where | Free tier notes |
|---|---|---|
| MongoDB | **MongoDB Atlas** (M0) | 512 MB, more than enough for a room's expenses |
| API (Node / Express) | **Render** (Node web service) | sleeps after 15 min idle; first request takes ~30–60 s to wake |
| Web app (React) | **Vercel** | instant, global CDN |
| Android app | **EAS Build** → APK installed on your phone | no Android Studio needed |

Do them in this order, because each step needs a URL from the previous one.

---

## 1. MongoDB Atlas

1. https://cloud.mongodb.com → create a free **M0** cluster (region: Mumbai `ap-south-1` is closest to Chennai).
2. **Database Access** → Add user, e.g. `kanakku` with a strong password (letters + digits only avoids URL-encoding trouble).
3. **Network Access** → Add IP → **Allow access from anywhere** (`0.0.0.0/0`). Render's outbound IPs change, so this is the practical choice for a hobby project.
4. **Database → Connect → Drivers** → copy the connection string. It looks like:
   `mongodb+srv://kanakku:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   Replace `<password>`. This is your `MONGODB_URI`. The database name is set separately (`MONGODB_DB=kanakku`), collections and indexes are created automatically on first start.

## 2. Push the code to GitHub

```bash
cd kanakku
git init
git add .
git commit -m "Kanakku"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/kanakku.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `.env` and build output.

## 3. API on Render

The repo has a `render.yaml` Blueprint that deploys `api/` as a **Node** web service (`npm ci` → `npm start`).

1. https://dashboard.render.com → **New → Blueprint** → connect the GitHub repo → Render shows the `kanakku-api` service.
2. It asks for `MONGODB_URI` (paste the Atlas string). `JWT_SECRET` is auto-generated. `CLIENT_ORIGINS` can stay empty (= allow any origin; bearer tokens, no cookies).
3. Deploy. First build takes ~2 min. When it's live, open `https://kanakku-api-xxxx.onrender.com/health` → `{"status":"ok"}`.
4. Your API base URL for the apps is `https://kanakku-api-xxxx.onrender.com/api`.

Without the Blueprint: New → Web Service → runtime **Node**, root directory `api`, build command `npm ci`, start command `npm start`, plan Free, add the same env vars, health check path `/health`.

Optional: seed a demo room into Atlas from your laptop — `cd api && MONGODB_URI="<atlas uri>" npm run seed` (accounts `sathish@demo.kanakku` etc., password `demo1234`).

**Cold starts:** the free instance sleeps after 15 min idle. Both apps use a 60 s timeout and show "Waking up the server…". If that bothers you, Render's cheapest paid instance never sleeps; or ping `/health` every 10 minutes with a free uptime monitor.

**Logs:** Render → the service → Logs. The API logs "MongoDB connection failed — check MONGODB_URI" if the Atlas URI is wrong (it still answers `/health` so you can see the deploy went through).

## 4. Web app on Vercel

1. https://vercel.com → **Add New → Project** → import the repo.
2. **Root Directory**: `web`. Framework preset: Vite (auto-detected; `web/vercel.json` adds the SPA rewrite).
3. **Environment variable**: `VITE_API_URL` = `https://kanakku-api-xxxx.onrender.com/api`.
4. Deploy → you get `https://kanakku-xxxx.vercel.app`. Every push to `main` redeploys.

Optional: set `CLIENT_ORIGINS=https://kanakku-xxxx.vercel.app,https://*.vercel.app` on Render to lock CORS to your site.

## 5. Android APK with EAS (no Android Studio)

```bash
cd mobile
npm ci                       # IMPORTANT after unzipping — EAS needs node_modules to resolve expo-router
npm i -g eas-cli
eas login                    # free Expo account
```

Edit `mobile/eas.json` → set `EXPO_PUBLIC_API_URL` in the `preview` profile to your Render URL (`https://kanakku-api-xxxx.onrender.com/api`). Then:

```bash
eas build -p android --profile preview
```

The build runs on Expo's servers (closing your terminal is fine once it's uploaded). When it finishes, EAS prints a download link — open it on your phone, install the APK (allow "install from unknown sources"), sign in with the same account you used on the web.

Your roommates: send them the APK link or the Vercel URL, they create an account, and join your group with the invite code.

To try the app before building an APK: `npx expo start` and scan the QR with **Expo Go** (set `EXPO_PUBLIC_API_URL` in `mobile/.env` to either the Render URL or `http://<your-laptop-ip>:5080/api` while the API runs locally).

---

## Local development

```bash
# API (needs Node 20+ and a MongoDB — local, Atlas, or the compose file below)
cd api
npm install
cp .env.example .env             # MONGODB_URI, JWT_SECRET
npm run dev                      # http://localhost:5080
npm run seed                     # optional demo data
npm test                         # 36 end-to-end tests (no MongoDB needed — uses an in-memory server)
# or API + MongoDB together in Docker:
docker compose up --build        # from the repo root

# Web
cd web
npm install
cp .env.example .env             # VITE_API_URL=http://localhost:5080/api
npm run dev                      # http://localhost:5173

# Mobile
cd mobile
npm install
npx expo start
```

The API reads `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET`, `CLIENT_ORIGINS`, `PORT` from the environment (or `api/.env`); the only local default that matters is `MONGODB_URI=mongodb://127.0.0.1:27017`.

## Updating later

Push to GitHub → Render and Vercel redeploy automatically. For the phone, run `eas build` again and reinstall the APK (same package name, data stays on the server so nothing is lost).
