# Space Case Cruises — Full-Stack Recreation Prompt

**Use this prompt in a new VS Code / Cursor project to recreate the entire Space Case Cruises architecture from scratch.** Paste the entire "Instructions" section into the AI (or a new chat) and request generation step-by-step.

---

## Instructions (copy everything below this line)

---

Recreate a full-stack application named **Space Case Cruises** with the following bulletproof specification. Implement everything in order; do not skip steps.

---

## 1. Project layout and monorepo structure

- **Root**: Node.js API (Express), TypeScript, ESM. Name: `space-case-cruises-api`, version `0.1.0`, `"type": "module"`.
- **Frontend**: `ui/` — Vite + React 19 + TypeScript, separate `package.json` (name `ui`), ESM.
- **No workspace/workspaces** — two separate apps: root = API, `ui/` = SPA. API runs on port 4000; UI dev server proxies `/api` and `/uploads` to `http://localhost:4000`.

**Root directory must contain:**
- `package.json`, `tsconfig.json`, `src/`, `docs/` (OpenAPI), `Dockerfile`, `Dockerfile.ui` (for UI build), `docker-compose.yml`, `.env.example`, `.gitignore`.
- `ui/` must contain: `package.json`, `tsconfig.json`, `vite.config.ts`, `src/`, `index.html`, `public/`, `Dockerfile.ui` build run from context `ui` with `dockerfile: ../Dockerfile.ui`.

---

## 2. Backend: config and env

- **`src/config/env.ts`**: Load with `import "dotenv/config"`. Export a single `env` object with:
  - `nodeEnv`, `port` (default 4000), `requestTimeoutMs` (default 10000), `databaseUrl` (string | null), `supabaseUrl`, `supabaseAnonKey`, `useSupabaseAuth` (boolean), `allowHeaderAuth` (boolean; default true when NODE_ENV !== "production"), `corsAllowedOrigins` (array of strings from comma-separated env; empty = allow all), `enableRateLimit` (boolean; default true in production), `rateLimitWindowMs`, `rateLimitMax`, `rateLimitAuthWindowMs`, `rateLimitAuthMax`, `firebaseProjectId`, `firebaseServiceAccount` (string | null). Use small helpers: `parseNumber(value, fallback)`, `parseBoolean(value, fallback)`.
- **`src/config/validateEnv.ts`**: Import `env` from `./env.js`. In **production only**, require `DATABASE_URL` and `FIREBASE_SERVICE_ACCOUNT`; if missing, log to stderr and `process.exit(1)`. Do not block in development.
- **Entry**: `src/server.ts` imports `./config/validateEnv.js` first, then `app` from `./app.js`, then `app.listen(env.port, ...)`.

---

## 3. Backend: domain types

- **`src/types/domain.ts`**: Define and export:
  - **Enums/literals**: `Role = "user" | "admin"`, `PronounsType`, `PreferredContactType`, `CommitmentStatus`, `CruiseStatus`, `TileVisibilityState`.
  - **Interfaces**: `User` (id, email, playaName, phoneNumber, preferredContact, pronouns, avatarUrl, cadetExtension, role, isDisabled, createdAt, updatedAt), `Badge`, `BadgeAssignment`, `Commitment` (with cruise/subgroup denormalized fields), `Cruise`, `Subgroup`, `CruiseSubgroup` (visibilityState, dockVisible, mapX, mapY, mapScale, etc.). All ids strings; timestamps ISO strings; nullable fields explicit.

---

## 4. Backend: data layer — in-memory store

- **`src/data/store.ts`**: In-memory arrays/maps: `users`, `badges`, `badgeAssignments`, `cruises`, `subgroups`, `cruiseSubgroups`, `commitmentsByUser` (Map<userId, Commitment[]>). Export CRUD-style functions matching repository names: `findUserById`, `findUserByEmail`, `updateUser`, `deleteUser`, `userHasCadetExtension`, `listBadges`, `findBadgeById`, `createBadge`, `updateBadge`, `listBadgeAssignments`, `findBadgeAssignmentById`, `findActiveBadgeAssignment`, `createBadgeAssignment`, `revokeBadgeAssignment`, `getUserBadges`, `getUserCommitments`, `getAllCommitments`, `findCommitment`, `listCommitmentsForCruiseSubgroup`, `createCommitment`, `transitionCommitment` (actions: commit, withdraw, recommit), `listCruises(includeArchived)`, `findCruiseById`, `createCruise`, `updateCruise`, `listSubgroups`, `findSubgroupById`, `subgroupSlugExists`, `subgroupCodeExists`, `subgroupExtensionExists`, `createSubgroup`, `updateSubgroup`, `listCruiseSubgroups`, `findCruiseSubgroupById`, `cruiseSubgroupPairExists`, `createCruiseSubgroup`, `updateCruiseSubgroup`, `resolveCruiseSubgroupVisibility`, `resolveCruiseStatus`. Include seed data: at least one admin user (`admin@spacecase.local`), one cadet (`cadet@spacecase.local`), one cruise, two subgroups, one cruise-subgroup assignment, one commitment, one badge, one badge assignment. Export `createMemoryStoreSnapshot()` and `applyMemoryStoreSnapshot(snapshot)` for backup/restore (type `MemoryStoreSnapshot`).

---

## 5. Backend: data layer — PostgreSQL repository

- **`src/data/db.ts`**: Export `isDatabaseEnabled` (true when `env.databaseUrl` is set), `pool` (pg.Pool or null). Use `ssl: env.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false }`.
- **`src/data/repository.ts`**: For every store function, export an async version that: if `!isDatabaseEnabled || !pool` delegates to the in-memory store; else runs parameterized SQL and maps rows to domain types. Use snake_case column names (e.g. `playa_name`, `cruise_id`, `cruise_subgroup_id`, `cadet_extension`, `default_cost_level`, `visibility_state`, `dock_visible`, `map_x`, `map_y`, `map_scale`). Tables: `users`, `cruises`, `subgroups`, `cruise_subgroups`, `badges`, `cadet_badges`, `commitments`. For commitments, use a join query that returns denormalized cruise/subgroup names and extension. Implement `findOrCreateUserByEmail(email, options?)` for auth (upsert by email; support optional `playaName`, `role`). Implement `applyCruiseMapBatchUpdates(cruiseId, updates[])` in a transaction. After each mutation in repository (create/update/delete), call `writeBackupSnapshot(reason)` (fire-and-forget). Export `getRuntimeMode(): "postgres" | "memory"` and `seedMemoryTimestamps()`.

---

## 6. Backend: backup

- **`src/data/backup.ts`**: Directory `backups/`, `backups/snapshots/`. When in memory mode: on write, serialize `createMemoryStoreSnapshot()` to `backups/snapshots/<timestamp>--memory.json` and `backups/latest-memory.json` (payload: `{ mode: "memory", reason, timestamp, snapshot }`). When in Postgres mode: snapshot all table rows to `backups/snapshots/<timestamp>--database.json` and `backups/latest-database.json`. Prune snapshots to a max (e.g. 100). Export `writeBackupSnapshot(reason)` (async) and `restoreLatestMemoryBackupIfPresent()` (sync; only in memory mode; read `latest-memory.json` and `applyMemoryStoreSnapshot` if valid).

---

## 7. Backend: middleware

- **`src/middleware/errors.ts`**: Class `HttpError` extends Error with `statusCode`, `code`, `details`. Export `errorHandler` middleware: ZodError → 422 with `VALIDATION_ERROR`; HttpError → statusCode with error body `{ error: { code, message, details } }`; else 500 `INTERNAL_SERVER_ERROR`.
- **`src/middleware/sanitize.ts`**: Middleware that recursively sanitizes `req.body` and `req.query`: strip control chars and HTML tags, cap string length (e.g. 64k body, 2k query). Run after `express.json()`.
- **`src/middleware/auth.ts`**: Extend Express Request with `authUser?: User`. Resolve user in order: (1) Firebase Bearer token → `resolveFirebaseIdentity` → `findOrCreateUserByEmail` (chancellor claim → admin role); (2) Supabase Bearer token → `resolveSupabaseIdentity` → `findOrCreateUserByEmail`; (3) if `allowHeaderAuth`, `x-user-id` or `x-user-email` → find by id or email. Export `requireAuth` (401 if no user or user disabled), `tryAuth` (optional auth), `requireRole(allowedRoles: Role[])` (must be after requireAuth; 403 if role not in list).

---

## 8. Backend: auth providers

- **`src/auth/firebase.ts`**: If `env.firebaseProjectId` and `env.firebaseServiceAccount` set, init Firebase Admin (`firebase-admin`): support service account as file path (starts with `.` or `/`) or inline JSON string. Export `isFirebaseConfigured`, `getAuthMode()` returning `"firebase" | "supabase" | "header-sim"`, `resolveFirebaseIdentity(idToken)` returning `{ email, playaName, uid, chancellor }` (chancellor from custom claim `chancellor` or `role === "chancellor"`).
- **`src/auth/supabase.ts`**: If Supabase URL and anon key and `useSupabaseAuth`, create Supabase client. Export `isSupabaseConfigured`, `resolveSupabaseIdentity(accessToken)` returning `{ email, playaName }`.

---

## 9. Backend: Express app wiring

- **`src/app.ts`**: Import `express-async-errors` first. Use express(), disable `x-powered-by`. Call `restoreLatestMemoryBackupIfPresent()` on startup. Use helmet (contentSecurityPolicy: false, crossOriginResourcePolicy cross-origin, HSTS only in production). CORS: if `corsAllowedOrigins.length` use it with credentials true. Optional global rate limit (skip `/health`). `express.json({ limit: "1mb" })`, then `sanitizeInputs`. Mount `express.static(uploadsRootDir)` at `/uploads` with Cross-Origin-Resource-Policy. Response timeout middleware using `env.requestTimeoutMs`; on timeout respond 504 TIMEOUT. `GET /health` → `{ status: "ok", mode: getRuntimeMode() }`. Stricter rate limit on `/api/v1/auth` (e.g. 20 per 15 min), skip `/api/v1/auth/mode`. Mount `/api/v1/admin` with `requireAuth`, `requireRole(["admin"])` so all admin routes are protected. Mount routers: auth, cadre, cadets, profile, admin, cruises, subgroups, cruise-subgroups, commitments, map, badges, uploads under `/api/v1`. 404 handler (HttpError NOT_FOUND). Then `errorHandler`.

---

## 10. Backend: routes (pattern)

- All route modules export a Router. Use Zod for query/body validation; throw HttpError(404/422/403/409) as needed. Use `request.authUser` from auth middleware. Call repository async functions (repository.ts), not store directly. Return JSON with snake_case keys for API (e.g. `playa_name`, `cruise_id`).
- **Auth**: `GET /api/v1/auth/mode` (public) → auth mode; `GET /api/v1/auth/session` (requireAuth) → current user summary.
- **Cadre**: `GET /api/v1/cadre` — list users with search/sort/pagination (q, sort, order, page, page_size); optional tryAuth for richer data.
- **Cadets**: `GET /api/v1/cadets/:id` — public cadet profile.
- **Profile**: `GET /api/v1/profile`, `PATCH /api/v1/profile` (requireAuth) — self profile.
- **Admin**: `PATCH /api/v1/admin/cadets/:id` — update role, cadet_extension, is_disabled.
- **Cruises**: `GET /api/v1/cruises` (query include_archived); `POST /api/v1/admin/cruises`, `PATCH /api/v1/admin/cruises/:id`.
- **Subgroups**: `GET /api/v1/subgroups`; `POST /api/v1/admin/subgroups`, `PATCH /api/v1/admin/subgroups/:id`.
- **Cruise-subgroups**: `GET /api/v1/cruises/:cruiseId/subgroups`; `POST /api/v1/admin/cruises/:cruiseId/subgroups`, `PATCH /api/v1/admin/cruise-subgroups/:id`.
- **Cruise-subgroup detail**: `GET /api/v1/cruise-subgroups/:id` (query include_committed_cadets) — commitment count and optional list of committed cadets.
- **Commitments**: `POST /api/v1/commitments/toggle` (requireAuth) — body `cruise_subgroup_id`, `action` (commit | withdraw | recommit).
- **Map**: `PATCH /api/v1/admin/cruises/:cruiseId/map/batch` — body `items[]` with cruise_subgroup_id, visibility_state, dock_visible, map_x, map_y, map_scale.
- **Badges**: `GET /api/v1/badges`; `POST /api/v1/admin/badges`, `PATCH /api/v1/admin/badges/:id`; `POST /api/v1/admin/badge-assignments` (user_id, badge_id, reason?), `GET` list, `PATCH /api/v1/admin/badge-assignments/:id/revoke`.
- **Uploads**: Multer; upload root `uploads/` (resolve from process.cwd()). Subdirs by type: subgroup-tile, subgroup-poster, cruise-map, cruise-special, cadet-avatar (and extras e.g. badges/icons). Query params: type, name?, ref?. Validate type with Zod; image-only fileFilter; 8MB limit, single file. `POST /api/v1/uploads/avatar` (requireAuth, type=cadet-avatar only). `POST /api/v1/admin/uploads` (requireAuth; admin or cadet-avatar). Return 201 with type, file_name, relative_path, url (`/uploads/...`). Export `uploadsRootDir` for app.ts static mount. Helper `findClosestUploadFileUrl(type, name)` for matching uploads by slugified name.

---

## 11. Backend: OpenAPI and generated client

- **`docs/openapi.yaml`**: OpenAPI 3.1.0. Servers url `http://localhost:4000`. Security schemes: apiKey header `x-user-email`, `x-user-id`. Document all paths above with tags, parameters, requestBody, responses; shared schemas (ErrorResponse, Role, CruiseStatus, VisibilityState, CommitmentStatus, etc.). Path parameters as uuid where applicable.
- **Script**: `generate:client` — run `openapi-typescript docs/openapi.yaml -o src/generated/api-types.ts`.
- **`src/generated/client.ts`**: Typed API client class from `api-types`: constructor(baseUrl, headers), `request({ path, method, pathParams?, query?, body?, headers? })`, helpers `getSession()`, `getCadre(query?)`, `getCruises(query?)`, `toggleCommitment(body)`, `patchCruiseMapBatch(cruiseId, body)`. Path params substituted in path string. Throw on non-ok response.
- **`src/generated/client.example.ts`**: Example script using `createApiClient`, reading `API_BASE_URL` from env, calling getSession, getCadre, etc. Run with `npm run example:client`.

---

## 12. Backend: scripts and tests

- **`src/scripts/seed.ts`**: If DATABASE_URL set, optionally run SQL seed/migrations; else ensure in-memory store has seed data. Use repository.
- **`src/scripts/seed-reset.ts`**: Only if `ALLOW_DB_RESET=true`; reset DB or memory store and re-seed.
- **Vitest**: `test` script runs vitest. At least one smoke test for `GET /health` and one for an API route (e.g. auth mode or cadre). Use supertest against the express app.

---

## 13. Backend: package.json

- Dependencies: express, cors, helmet, express-rate-limit, dotenv, zod, multer, pg, firebase-admin, @supabase/supabase-js, express-async-errors. Dev: types (express, node, cors, multer, pg, supertest), tsx, typescript, vitest, openapi-typescript.
- Scripts: dev (tsx watch src/server.ts), build (tsc), start (node dist/server.js), check (tsc --noEmit), seed:db, seed:reset, generate:client, example:client, test, test:db (optional Postgres integration).

---

## 14. Backend: TypeScript

- **tsconfig.json**: target ES2022, module NodeNext, moduleResolution NodeNext, strict, rootDir src, outDir dist. Include src. No path aliases.

---

## 15. Frontend: build and config

- **ui/package.json**: react, react-dom, firebase. Dev: vite, @vitejs/plugin-react, typescript, @types/react, @types/react-dom, @types/node. Scripts: dev, build (tsc -b && vite build), preview, lint.
- **ui/vite.config.ts**: React plugin; server proxy `/api` and `/uploads` to `http://localhost:4000`.
- **ui/tsconfig.json**: references to tsconfig.app.json and tsconfig.node.json.
- **ui/tsconfig.app.json**: target ES2022, module ESNext, moduleResolution bundler, jsx react-jsx, strict, noEmit true, types vite/client, include src.

---

## 16. Frontend: env and API base

- **ui/.env.example**: VITE_API_BASE_URL (default http://localhost:4000), VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID.
- In app, base URL for API: `import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"`. No trailing slash.

---

## 17. Frontend: Firebase auth (client)

- **ui/src/firebase.ts**: Init Firebase app from `import.meta.env.VITE_FIREBASE_*`. Export auth, signInWithEmail, signUpWithEmail, signInWithGoogle, signOutUser, onAuthChange, getIdToken (for Bearer token).

---

## 18. Frontend: App structure

- **ui/src/App.tsx**: Single-page app. On load: fetch `GET .../api/v1/auth/mode` to determine auth mode (firebase | supabase | header-sim). If firebase/supabase: use Firebase auth (or Supabase) and pass Bearer token on API calls; show sign-in/sign-up (email/password and Google) and sign-out. If header-sim: optional dev switcher (admin/cadet) and send x-user-email header. State: authMode, session (current user from GET /api/v1/auth/session), profile, cadre, cruises, subgroups, cruiseSubgroups, error. Use fetch with Authorization: Bearer &lt;token&gt; when signed in. Implement at least: auth mode + session, cadre list (with optional search/sort/pagination), cruises list, subgroups list, cruise-subgroups for a cruise, commitment toggle for current user, profile read/patch. Types for API responses: snake_case (e.g. playa_name, cruise_id). Handle 401/403 and show login or error message.

---

## 19. Frontend: index and assets

- **ui/index.html**: Root div, script type=module src=/src/main.tsx.
- **ui/src/main.tsx**: React 18 createRoot, render App, strict mode.
- **ui/public/**: favicon or placeholder (e.g. vite.svg). Optional test-image.svg.

---

## 20. Root .env.example

- Comment: Copy to .env before docker compose.
- UI section: VITE_API_BASE_URL, all VITE_FIREBASE_* (placeholder values or your project).
- API section: PORT=4000, REQUEST_TIMEOUT_MS, DATABASE_URL (empty or postgres URL), NODE_ENV, ALLOW_DB_RESET, USE_SUPABASE_AUTH, SUPABASE_URL, SUPABASE_ANON_KEY, ALLOW_HEADER_AUTH, CORS_ALLOWED_ORIGINS, ENABLE_RATE_LIMIT, RATE_LIMIT_*, FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT (path or JSON string). Optional RATE_LIMIT_AUTH_WINDOW_MS, RATE_LIMIT_AUTH_MAX.

---

## 21. Docker

- **Dockerfile** (root): Multi-stage. Builder: node 20 alpine, WORKDIR /app, copy package*.json, npm install, copy ., npm run build; copy firebase-service-account.json and src/data into dist if needed. Final: node 20 alpine, copy dist, package*.json, node_modules, EXPOSE 3000 (or 4000), CMD node dist/server.js. Server reads PORT from env (4000).
- **Dockerfile.ui**: Multi-stage. Build stage: node 20 alpine, ARG/ENV for all VITE_* (VITE_API_BASE_URL, VITE_FIREBASE_*), copy ui package*.json, npm install, copy ., npm run build. Final: nginx alpine, copy dist to /usr/share/nginx/html, EXPOSE 80, CMD nginx -g "daemon off".
- **docker-compose.yml**: Services `api` (build context ., dockerfile Dockerfile, ports 4000:4000, env_file .env, environment PORT=4000, CORS_ALLOWED_ORIGINS with default); `ui` (build context ui, dockerfile ../Dockerfile.ui, build args all VITE_* with defaults, ports 80:80). No volumes required for minimal run.

---

## 22. Docs and README

- **README.md**: Project name; quick start (npm install, optional DATABASE_URL and migrations, npm run dev, GET /health, npm test); UI in ui/ (npm install, npm run dev, VITE_API_BASE_URL); auth simulation (x-user-id, x-user-email); Firebase auth (backend FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT; frontend VITE_FIREBASE_*); Supabase optional; list of key routes; OpenAPI and generate:client; seed users admin@spacecase.local, cadet@spacecase.local.
- **FIREBASE_SETUP.md**: Steps to create Firebase project, enable Email/Password and Google auth, get web config for ui/.env, get service account for root .env, .gitignore, first admin (e.g. SQL update role), production deployment note.

---

## 23. Optional: migrations and Postgres schema

- If you add PostgreSQL: create a `migrations/` folder and an initial SQL file (e.g. `001_initial_space_case_schema.sql`) that creates tables matching repository column names: users (id uuid PK, email unique, playa_name, phone_number, preferred_contact, pronouns, avatar_url, cadet_extension, role, is_disabled, created_at, updated_at), cruises, subgroups, cruise_subgroups, badges, cadet_badges (badge assignments), commitments (user_id, cruise_subgroup_id, status, committed_at, withdrawn_at, completed_at, updated_at, plus any denormalized columns or views if used). Use UUID primary keys and appropriate indexes. README can reference: `psql "$DATABASE_URL" -f migrations/001_initial_space_case_schema.sql`.

---

## 24. Security and hardening

- Never commit .env or firebase-service-account.json; .gitignore both.
- In production, require DATABASE_URL and FIREBASE_SERVICE_ACCOUNT (validateEnv).
- Sanitize all body/query input (sanitize middleware).
- Admin routes strictly behind requireAuth + requireRole(["admin"]).
- CORS: set explicit origins in production; no wildcard with credentials.
- Rate limit auth endpoints more aggressively than general API.

---

## 25. Deliverables checklist

- [ ] Root API runs with `npm run dev`, responds on port 4000, GET /health returns mode.
- [ ] With DATABASE_URL unset, API runs in memory mode and restores from backups/latest-memory.json if present.
- [ ] With Firebase configured, GET /api/v1/auth/mode returns "firebase"; Bearer token works for /api/v1/auth/session.
- [ ] UI runs with `cd ui && npm run dev`; proxies /api and /uploads to API; can sign in (Firebase or header-sim) and call API with token or headers.
- [ ] docker compose up -d --build runs API on 4000 and UI on 80; UI build args include VITE_API_BASE_URL and Firebase vars.
- [ ] OpenAPI spec in docs/openapi.yaml; npm run generate:client produces src/generated/api-types.ts; typed client in src/generated/client.ts.
- [ ] All routes listed in README exist and return consistent error shape { error: { code, message, details } }.
- [ ] Seed data includes at least one admin, one cadet, one cruise, subgroups, one commitment, one badge assignment.

---

End of instructions. Generate the codebase in logical order: config → types → store → db → repository → backup → auth (firebase, supabase) → middleware → routes → app → server → OpenAPI → client → UI (firebase, App) → Docker → README and FIREBASE_SETUP. Run and fix any missing pieces until the checklist passes.
