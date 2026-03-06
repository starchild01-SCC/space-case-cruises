# Deploying to Hostinger – Pre-upload checklist

Do these **before** you upload or deploy.

---

## Shared hosting only (FTP / File Manager)

On **shared hosting you can only serve static files**. The Node.js API **cannot** run there. Do this:

### 1. Host the API somewhere else

Deploy the **API** to a service that runs Node.js, for example:

- **[Render](https://render.com)** – free tier for web services + Postgres
- **[Railway](https://railway.app)** – free tier, easy Node + Postgres
- **[Fly.io](https://fly.io)** – free tier for small apps
- **[Neon](https://neon.tech)** or **[Supabase](https://supabase.com)** – free Postgres; run the API on Render/Railway/Fly and point `DATABASE_URL` at Neon/Supabase

You’ll get a URL like `https://your-api.onrender.com` (no path) or `https://your-api.fly.dev`. The app expects the API at a base path like `/api/v1`, so either:

- Run the API so it serves at `https://your-api.onrender.com/api/v1`, or  
- Use whatever base URL the host gives you (e.g. `https://your-api.onrender.com`) and set `VITE_API_BASE_URL` to that (the app will add `/api/v1`).

### 2. Build the UI with that API URL

On your **local machine** (or CI), in the project root:

```bash
cd ui
npm install
```

Create a small env file or set env vars for the build (use your real values):

**Windows (cmd):**

```cmd
set VITE_API_BASE_URL=https://your-api.onrender.com
set VITE_FIREBASE_API_KEY=your-key
set VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
set VITE_FIREBASE_PROJECT_ID=your-project-id
set VITE_FIREBASE_STORAGE_BUCKET=your-bucket
set VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
set VITE_FIREBASE_APP_ID=your-app-id
npm run build
```

**Mac/Linux (bash):**

```bash
export VITE_API_BASE_URL=https://your-api.onrender.com
export VITE_FIREBASE_API_KEY=your-key
export VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
export VITE_FIREBASE_PROJECT_ID=your-project-id
export VITE_FIREBASE_STORAGE_BUCKET=your-bucket
export VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
export VITE_FIREBASE_APP_ID=your-app-id
npm run build
```

(Or put those in `ui/.env.production` and run `npm run build` – Vite will use it.)

### 3. Upload only the built UI

- After `npm run build`, the static site is in **`ui/dist/`**.
- Upload the **contents** of `ui/dist/` (not the folder itself) into your Hostinger **public_html** (or the domain’s document root) via FTP or File Manager.
- So: `index.html`, `assets/`, etc. at the root of the site.

### 4. Configure the API for your domain

On the API host (Render/Railway/etc.):

- Set **`CORS_ALLOWED_ORIGINS`** to your Hostinger site, e.g. `https://yourdomain.com` (no trailing slash).
- Set **Firebase** and **DATABASE_URL** as in section 3 below.
- Add your Hostinger domain to **Firebase Console → Authentication → Authorized domains**.

### Summary for shared hosting

| What | Where |
|------|--------|
| **Frontend (UI)** | Hostinger – upload contents of `ui/dist/` to public_html |
| **Backend (API)** | Render / Railway / Fly.io / etc. – deploy Node app + DB |
| **Database** | Same as API host or Neon/Supabase |
| **Auth** | Firebase – add your Hostinger domain to authorized domains |

---

## 1. Know how you’re hosting

- **Shared hosting (FTP / File Manager):** Usually only **static files** (HTML/JS/CSS). You can upload the **built UI** only if your **API runs elsewhere** (e.g. another Hostinger Node app, or a separate backend host).
- **VPS or Node.js hosting:** You can run both the **API** and serve the **built UI** (e.g. API on a port, UI via nginx or static hosting).

---

## 2. Don’t upload these

Never upload via FTP or include in production:

- `.env` (contains secrets – set env vars on the server instead)
- `node_modules/` (install on server with `npm install --production` or let the panel do it)
- `ui/node_modules/`
- `dist/` and `ui/dist/` (build on the server or in CI, then upload/use the built output)
- `backups/`, `uploads/` (unless you intentionally migrate data)
- `firebase-service-account.json` (use env or secure config on server only)
- Anything in `.gitignore` that looks sensitive

---

## 3. Production environment variables

Set these **on the server** (Hostinger env / .env on VPS), not in the repo.

**API (backend):**

| Variable | Example / note |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `PORT` | e.g. `4000` (or what Hostinger assigns) |
| `DATABASE_URL` | PostgreSQL connection string (Hostinger DB or external e.g. Neon, Supabase) |
| `CORS_ALLOWED_ORIGINS` | `https://yourdomain.com` (your real UI origin, comma-separated if multiple) |
| `ALLOW_HEADER_AUTH` | `false` (disable dev header auth in production) |
| `ENABLE_RATE_LIMIT` | `true` |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT` | Path to JSON file on server **or** the JSON string (see FIREBASE_SETUP.md) |
| `ALLOW_DB_RESET` | `false` |

**UI (build-time only):**  
These are baked into the frontend at **build** time. Set them when you run `npm run build` in `ui/` (or in Hostinger’s build step):

| Variable | Example / note |
|----------|-----------------|
| `VITE_API_BASE_URL` | `https://yourdomain.com/api/v1` or `https://api.yourdomain.com/api/v1` – must match how the browser will call your API |
| `VITE_FIREBASE_API_KEY` | From Firebase Console |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Same as backend |
| `VITE_FIREBASE_STORAGE_BUCKET` | Your bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | From Firebase |
| `VITE_FIREBASE_APP_ID` | From Firebase |

---

## 4. Build steps (before or during deploy)

**API:**

```bash
npm install
npm run build
# Start with: npm start  (runs node dist/server.js)
```

**UI:**  
Build with the **production** API URL and Firebase config:

```bash
cd ui
npm install
# Set env vars for this build (see table above), then:
npm run build
```

Upload or serve the contents of `ui/dist/` as your site root (or point your web server at that folder).

---

## 5. Database

- If Hostinger provides **PostgreSQL**, create a database and user, run the migration:
  - `migrations/001_initial_space_case_schema.sql`
- Then: `DATABASE_URL=postgresql://user:pass@host:5432/dbname npm run db:init` and optionally `npm run seed:db`.
- If Hostinger doesn’t offer Postgres, use a managed DB (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com)), set `DATABASE_URL`, and run the same migration + init/seed from your machine or a one-off deploy script.

---

## 6. Firebase

- In [Firebase Console](https://console.firebase.google.com/) → Authentication → Settings → **Authorized domains**, add your production domain (e.g. `yourdomain.com`).
- Keep the **service account JSON** only on the server (or in a secure env). Never commit it or expose it to the client.

---

## 7. CORS and API URL

- `CORS_ALLOWED_ORIGINS` must include the exact origin the browser uses for your UI (e.g. `https://yourdomain.com`). No trailing slash.
- `VITE_API_BASE_URL` must be the base URL the frontend uses to call the API (e.g. `https://yourdomain.com/api/v1` if the API is under a path, or `https://api.yourdomain.com/api/v1` if on a subdomain). No trailing slash.

---

## 8. Quick checklist

- [ ] Decided: UI only on Hostinger + API elsewhere, or both on Hostinger (e.g. VPS/Node).
- [ ] `.env` / secrets not uploaded; env vars set on server.
- [ ] `VITE_API_BASE_URL` and all `VITE_FIREBASE_*` set when building the UI.
- [ ] UI built with `cd ui && npm run build`; only `ui/dist/` (or its contents) uploaded/served.
- [ ] API built with `npm run build`; started with `npm start` (or Hostinger’s Node start command).
- [ ] Database created; migration applied; optional seed run.
- [ ] Firebase authorized domains include your production domain.
- [ ] `CORS_ALLOWED_ORIGINS` set to your frontend origin.
- [ ] `ALLOW_HEADER_AUTH=false` and `NODE_ENV=production` for the API.

After that, you’re ready to upload / deploy and test.
