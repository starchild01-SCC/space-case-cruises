# Synology GUI Deploy + Recovery (No Terminal)

Use this when changes are not appearing or login/images break after deploy.

## 1) Open Container Manager
1. DSM -> **Container Manager**.
2. Go to **Project**.
3. Select your project (space-case-cruises).

## 2) Force a clean rebuild
1. Click **Stop** for the project.
2. Click **Action** -> **Delete** (project only, keep files).
3. Re-create project from your `docker-compose.yml` in this repo folder.
4. In the create dialog, ensure **Build images before starting** is enabled.
5. Start the project.

Why: this guarantees Synology rebuilds from current source and does not reuse stale UI image layers.

## 3) Verify containers are healthy
1. In **Container Manager -> Container**, confirm both `api` and `ui` are running.
2. Open `api` container logs and confirm you do **not** see repeated startup errors.
3. Open `ui` container logs and confirm nginx started.

## 4) Browser validation checklist
Use a private/incognito window and hard refresh.

1. Open app: `http://<NAS-IP>:8080`
2. Confirm footer build stamp shows: **2026-03-02-02**
3. Click Sign In:
   - Google should popup or redirect.
   - If it fails, check exact error text in the dialog.
4. Check cruises/cards:
   - Images should load (no broken placeholders).

## 5) Firebase console checks (required)
In Firebase Console -> Authentication:
1. **Sign-in method**:
   - Enable **Google**
   - Enable **Email/Password**
2. **Settings / Authorized domains**:
   - Add the host you use in browser (NAS hostname/domain)
   - Add `localhost` for local testing

Note: if using an IP directly and Firebase rejects it as an authorized domain, use a hostname for NAS (local DNS or reverse proxy host) and access the app via that hostname.

## 5.1) If images load but login fails
This is the most common split-brain symptom:
- Images/API work from `http://<NAS-IP>:8080`
- Firebase login fails (Google popup or email auth)

Why:
- API and static files can work on raw IP.
- Firebase Auth is domain-based and typically does **not** allow raw LAN IP hosts for sign-in flows.

Fix path:
1. Access the app via a hostname/domain (not raw IP), for example:
   - your Cloudflare domain (recommended), or
   - a LAN hostname you control via local DNS/reverse proxy.
2. Add that exact host to Firebase Authorized domains.
3. Keep `VITE_API_BASE_URL` empty (same-origin) or set to that same hostname/domain.
4. Rebuild/redeploy UI after env changes.

Quick verify:
- Open browser dev tools Console during login.
- If you see `auth/unauthorized-domain`, this section is the root cause.
- If you see `auth/operation-not-allowed`, enable the provider in Firebase Sign-in method.

## 6) If app still shows old behavior
- You are still on old UI bundle.
- Repeat Step 2 and ensure "Build images before starting" is checked.
- Clear browser cache/site data for the app origin.

## 7) One-time hard reset (recommended if routes return 500 after DB migration)
Use this when `/api/v1/cruises` or `/api/v1/subgroups` returns 500 after switching to PostgreSQL.

This fully resets DB schema/data and rebuilds containers so code + database are in sync.

### CLI path (fastest)
1. Stop and remove containers:
   - `docker compose down`
2. Remove only Postgres data volume (destructive to DB data):
   - `docker volume rm space-case-cruises_postgres_data`
   - If your project name differs, run `docker volume ls | grep postgres_data` first.
3. Rebuild and start:
   - `docker compose up -d --build`
4. Initialize schema + seed data:
   - `docker compose exec api npm run db:init`
   - `docker compose exec api npm run seed:db`
5. Verify:
   - `curl -sS https://plugin2oneroom.com/api/health`
   - `curl -sS https://plugin2oneroom.com/api/v1/cruises`
   - `curl -sS https://plugin2oneroom.com/api/v1/subgroups`

Expected result:
- health shows `"mode":"postgres"`
- cruises/subgroups return JSON with `items` (not 500)

### Synology GUI path
1. In Container Manager, stop the project.
2. Delete the project (keep source files).
3. Delete the Postgres persistent volume for this project (the one ending in `postgres_data`).
4. Recreate project from `docker-compose.yml` with **Build images before starting** checked.
5. After start, open API container terminal and run:
   - `npm run db:init`
   - `npm run seed:db`

### Important notes
- This reset does **not** remove uploaded files in `uploads/`.
- It **does** remove Postgres content (users/commitments/badges/etc.) and recreates seed data.
