# FastAPI Migration Audit (Phase 1)

## Current Duplication
- Next.js API routes exist in `stemApp/app/api/**`.
- FastAPI backend exists in `stemApp/backend/api/**`.
- Both layers currently target DB writes, which creates split backend logic.

## Schema-Aligned Values (from `stemApp/db/schema.sql`)
- `organizations.status`: `pending`, `approved`, `rejected`, `inactive`
- `users.role`: `admin`, `partner`
- `events.status`: `pending`, `approved`, `rejected`

## Values Used by Current Next.js API/UI That Do Not Match Schema
- `organizations.status` currently uses: `active`, `pending`, `disabled`
- `users.role` currently uses: `super_admin`, `admin`, `partner`
- `events.status` currently uses: `pending`, `approved`, `denied`

## Fields Used by UI / Route Behavior Worth Adding to Schema
- `events.admin_comment`
  - Used by deny flow and event detail display.
  - Needed if denial reason must be persisted.
- `events.reviewed_at` and `events.reviewed_by_user_id`
  - Needed to audit approve/deny/revoke actions.
- `events.status` alternative option `denied`
  - Only if you want to preserve current UI naming.
  - Otherwise map UI `denied` -> DB `rejected`.
- `organizations.status` alternatives `active` / `disabled`
  - Only if you want to preserve current UI naming.
  - Otherwise map UI `active` -> DB `approved` and `disabled` -> DB `inactive`.
- `users.role` option `super_admin`
  - Needed if single-super-admin rule remains.
  - Alternative: keep DB roles as-is and move super-admin capability to separate permissions table.
- `invitations` table
  - Current invite endpoint generates tokens but does not persist them.
  - Needed for expiration checks, revocation, and registration flow integrity.

## FastAPI Migration Work Started
- Implemented FastAPI endpoints mirroring current admin route intents in `stemApp/backend/api/main.py`:
  - `POST /api/events/{event_id}/approve`
  - `POST /api/events/{event_id}/deny`
  - `POST /api/events/{event_id}/revoke`
  - `POST /api/organizations/{org_id}/status`
  - `POST /api/users/{user_id}/role`
  - `POST /api/users/{user_id}/delete`
  - `POST /api/users/invite`
- These now use current UI values for demo parity (`denied`, `active/disabled`, `super_admin`).

## Applied for Option 2 (Keep UI Values)
- Updated `stemApp/db/schema.sql` to support UI values and fields:
  - `organizations.status` includes `active`, `pending`, `disabled`
  - `users.role` includes `super_admin`
  - `events.status` includes `denied`
  - added `events.admin_comment`, `events.reviewed_at`, `events.reviewed_by_user_id`
  - added `invitations` table for invite token persistence
- Added migration script for existing DBs:
  - `stemApp/db/migrations/2026-02-27-ui-values.sql`

## Applied for Option 1 (FastAPI Owns API Routes)
- Frontend client calls now target FastAPI directly via `NEXT_PUBLIC_API_BASE_URL` helper:
  - `stemApp/lib/api.js`
- Updated callers:
  - `stemApp/app/components/EventsTable.js`
  - `stemApp/app/partners/PartnersTable.js`
  - `stemApp/app/users/UsersTable.js`
- Removed duplicate Next.js route handlers under `stemApp/app/api/**`.
- Added FastAPI CORS support (`CORS_ALLOW_ORIGINS`) in `stemApp/backend/api/main.py`.

## Required Environment Values
- Next.js: `NEXT_PUBLIC_API_BASE_URL` (example: `http://localhost:8000`)
- FastAPI: `CORS_ALLOW_ORIGINS` (example: `http://localhost:3000,http://127.0.0.1:3000`)

## Decision Status
- Selected: option 2 (`schema` updated to match current UI/API names for demos).
