# System Purge – Deployment & Data Sync Audit

This document summarizes the full system audit performed to fix deployment failures and data synchronization issues for hosting on Render.

---

## 1. NAS / Local Path Purge

### Where NAS/local references were

- **Application code**: No literal `NAS` or `/Volumes/` paths were found. No code reads from local disk paths for image content.
- **Backend** (`src/app.ts`): CORS already strips local/private origins in production (`192.168.*`, `10.*`, `*.local`) so they are not sent to the client.
- **Backend** (`src/server.ts`): `HOST_IP` is used only for an optional log line (e.g. “LAN: http://192.168.x.x:4000”). It is not used for any path or URL. Safe to leave unset on Render; comment added.
- **Stored data**: Backups and JSON/SQL exports may contain `localhost`, `192.168.x.x`, or `/api/uploads/` URLs. These are data, not app logic. The app now normalizes them when serving or displaying.

### Changes made

- **Backend** (`src/routes/media-url.ts`):
  - `normalizeMediaUrl()` now treats **private/local hosts** (e.g. `192.168.*`, `10.*`, `*.local`) like localhost: rewrites to the request origin so the API never returns NAS/local IPs.
  - `normalizeApiUploadsBridgeUrl()` rewrites absolute `http(s)://.../uploads/...` and `.../api/uploads/...` URLs to path-only `/api/uploads/...`, so responses never expose NAS or local IPs.
- **Frontend** (`ui/src/App.tsx` – `resolveMediaUrl()`):
  - Rewrites `localhost`, `127.0.0.1`, `192.168.*`, `10.*`, and `*.local` to `apiOrigin` for `/uploads/` and `/api/uploads/` paths so legacy DB URLs display correctly on Render.

Image URLs are **fetched from the API** (cruise_subgroups and related tables). The API returns normalized URLs (path-only or request origin); the UI resolves them with `apiOrigin`. No hardcoded local or NAS paths remain in app logic.

---

## 2. API / UI Sync (Admin vs Cruise Map)

### Current behavior

- **Single source**: Both the Admin UI and the Cruise Map use the same endpoint for per-cruise subgroup data: **GET `/api/v1/cruises/:cruiseId/subgroups`**, which uses `listCruiseSubgroups()` and reads from the **cruise_subgroups** bridge table.
- **Load flow**: The app fetches `/cruises` and `/subgroups` (catalog), then for each cruise fetches `/cruises/:id/subgroups`. The combined result is stored in `state.cruiseSubgroups` and used everywhere (Admin cruise dependency list and Cruise Map). No separate Admin-only endpoint is used for **reading** the list.
- **Add subgroup**: Admin uses the **subgroups** catalog only to pick which subgroup to add; it then calls **POST `/api/v1/admin/cruises/:cruiseId/subgroups`**, which performs an **INSERT** into **cruise_subgroups** (bridge). No catalog table is modified.
- **Reassign**: **PATCH `/api/v1/admin/cruise-subgroups/:id`** (and reassign flow in POST when the subgroup already exists on another cruise) performs **UPDATE** on **cruise_subgroups** only.

A comment was added in the frontend load logic: *“listCruiseSubgroups (cruise_subgroups bridge) is the single source; Admin and Cruise Map both use this.”*

No code changes were required for sync; the design already relies solely on the cruise_subgroups bridge for the list shown on both pages.

---

## 3. Deployment (Build & Start)

### package.json (API)

- **build**: `tsc -p tsconfig.json` – compiles to `dist/`. No local or NAS paths.
- **start**: `node dist/server.js` – runs the compiled app. Compatible with Render.

### package.json (UI)

- **build**: `tsc -b && vite build` – standard TypeScript + Vite. No local filesystem dependency for deployment.
- **preview**: `vite preview` – for local preview only; Render uses the built static assets from the UI build.

No changes were required. Build and start commands are compatible with Render and do not depend on local file system access for serving.

---

## 4. Date Formatting (One Day Early)

- **Display**: `formatCruiseDate()` in `ui/src/App.tsx` already uses the date-only part: `raw.includes("T") ? raw.split("T")[0] : raw` before formatting, so the browser does not apply timezone conversion to the displayed date.
- **Admin form**: `toEditableCruise()` now sets `starts_on` and `ends_on` with `cruise.starts_on.split("T")[0]` and `cruise.ends_on.split("T")[0]` so `<input type="date">` values match the intended calendar date.

No further changes were required for this audit.

---

## 5. Data Persistence (Add / Reassign)

- **Add subgroup to a cruise**: **POST `/api/v1/admin/cruises/:cruiseId/subgroups`** → `createCruiseSubgroup()` → **INSERT** into **cruise_subgroups**. The **subgroups** catalog is not modified.
- **Reassign subgroup to another cruise**: Same POST, when the subgroup already exists on another cruise, calls `updateCruiseSubgroup()` → **UPDATE cruise_subgroups** (e.g. `cruise_id`). **PATCH `/api/v1/admin/cruise-subgroups/:id`** also only **UPDATE**s **cruise_subgroups**.
- **Delete assignment**: **DELETE `/api/v1/admin/cruise-subgroups/:id`** → `deleteCruiseSubgroup()` → **DELETE** from **cruise_subgroups** only.

All add/reassign/delete operations target the **cruise_subgroups** bridge table only; the **subgroups** catalog table is not modified by these flows.

---

## Summary

| Area              | Status | Action |
|-------------------|--------|--------|
| NAS/local paths   | Done   | Backend and frontend normalize private/local hosts and absolute upload URLs so Render never sees NAS/local IPs. |
| API/UI sync       | Done   | Confirmed single source: listCruiseSubgroups (cruise_subgroups). Comment added in UI. |
| Build/start       | OK     | No changes; commands are Render-compatible. |
| Date formatting   | Done   | Already using date-only (split('T')[0]) in display and admin form. |
| Add/reassign      | OK     | INSERT/UPDATE only on cruise_subgroups; subgroups catalog unchanged. |

No hardcoded NAS or local file paths remain in application code. Image URLs come from the database and are normalized for safe use on Render.
