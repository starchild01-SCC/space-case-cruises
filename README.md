# Space Case Cruises API (Starter)

Phase 0 + Phase 2 backend starter generated from project specification and API contracts.

## Included
- Auth/session endpoint
- Cadre roster endpoint (search/sort/pagination)
- Public cadet profile endpoint
- Self profile read/update endpoint
- Admin cadet management endpoint (role/extension/disable)
- Cruises read/admin endpoints
- SubGroup library read/admin endpoints
- Cruise assignment editor endpoints
- SubGroup detail endpoint with commitment count
- Commitment lifecycle toggle endpoint
- Cruise map batch save endpoint
- Badge Studio endpoints
- RBAC middleware and typed validation
- Request timeout handling and consistent error payloads

## Quick Start
1. Install dependencies:
   - `npm install`
2. (Optional) Enable PostgreSQL mode:
   - Set `DATABASE_URL` in `.env`
   - Apply migration: `psql "$DATABASE_URL" -f ../migrations/001_initial_space_case_schema.sql`
   - Seed deterministic fixture data: `npm run seed:db`
   - Reset + reseed local DB state: `ALLOW_DB_RESET=true npm run seed:reset`
   - If `DATABASE_URL` is unset, the API runs in in-memory fallback mode
3. Start dev server:
   - `npm run dev`
4. Health check:
   - `GET /health`
5. Run smoke tests:
   - `npm test`
6. Run PostgreSQL integration tests (with `DATABASE_URL`):
   - `npm run test:db`

## Browser UI (Vite)
- Frontend app lives in `ui/`
- Start API first: `npm run dev`
- In a second terminal:
   - `cd ui`
   - `npm install --cache .npm-cache`
   - `npm run dev`
- Open the URL printed by Vite (usually `http://localhost:5173`)
- Optional: set custom API base with `VITE_API_BASE_URL` (defaults to `http://localhost:4000`)
   - Accepted formats: `http://localhost:4000` or `http://localhost:4000/api/v1`
   - Avoid other path suffixes (for example `/api`), which can cause route mismatches

## Auth Simulation (for local dev)
This starter uses headers to simulate auth:
- `x-user-id: <uuid>` or `x-user-email: <email>`

## Firebase Auth (recommended)
Enable real authentication with Firebase:
- Set up a Firebase project at https://console.firebase.google.com/
- Configure environment variables (see `FIREBASE_SETUP.md` for detailed instructions)
- Backend: `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT`
- Frontend: `VITE_FIREBASE_*` variables in `ui/.env`

**Quick setup:**
1. Create Firebase project and enable Email/Password + Google auth
2. Download service account JSON from Project Settings
3. Copy web app config to `ui/.env`
4. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for complete instructions

## Supabase Auth (optional)
Enable real bearer-token auth by setting:
- `USE_SUPABASE_AUTH=true`
- `SUPABASE_URL=<your-project-url>`
- `SUPABASE_ANON_KEY=<your-anon-key>`

Behavior:
- If `Authorization: Bearer <token>` is present, API validates token with Supabase or Firebase.
- Valid users are auto-provisioned in `users` table by email (role defaults to `user`).
- Header simulation (`x-user-id` / `x-user-email`) still works for local testing.

Seed users:
- Admin: `admin@spacecase.local`
- Cadet: `cadet@spacecase.local`

To call admin route locally, send `x-user-email: admin@spacecase.local`.

## Key Routes
- `GET /api/v1/auth/mode`
- `GET /api/v1/auth/session`
- `GET /api/v1/cadre`
- `GET /api/v1/cadets/:id`
- `GET /api/v1/profile`
- `PATCH /api/v1/profile`
- `PATCH /api/v1/admin/cadets/:id`
- `GET /api/v1/cruises`
- `POST /api/v1/admin/cruises`
- `PATCH /api/v1/admin/cruises/:id`
- `GET /api/v1/subgroups`
- `POST /api/v1/admin/subgroups`
- `PATCH /api/v1/admin/subgroups/:id`
- `GET /api/v1/cruises/:cruiseId/subgroups`
- `POST /api/v1/admin/cruises/:cruiseId/subgroups`
- `PATCH /api/v1/admin/cruise-subgroups/:id`
- `GET /api/v1/cruise-subgroups/:id`
- `POST /api/v1/commitments/toggle`
- `PATCH /api/v1/admin/cruises/:cruiseId/map/batch`
- `GET /api/v1/badges`
- `POST /api/v1/admin/badges`
- `PATCH /api/v1/admin/badges/:id`
- `POST /api/v1/admin/badge-assignments`
- `PATCH /api/v1/admin/badge-assignments/:id/revoke`

## API Contract File
- OpenAPI spec: `docs/openapi.yaml`
- Generate clients with your preferred tooling (e.g., OpenAPI Generator, Orval, Speakeasy)
- Built-in typed contract generation:
   - `npm run generate:client`
   - Output: `src/generated/api-types.ts`
- Included thin typed wrapper: `src/generated/client.ts`
   - `createApiClient({ baseUrl, headers })`
   - Helpers: `getSession`, `getCadre`, `getCruises`, `toggleCommitment`, `patchCruiseMapBatch`
- Example usage script: `src/generated/client.example.ts`
   - Run with: `API_BASE_URL=http://localhost:4000 npm run example:client`

## Next Build Steps
- Replace in-memory store with PostgreSQL repositories
- Add integration tests for auth + RBAC + validation
