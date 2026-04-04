# STEM-ACT Repo Cleanup — Audit Reference
> **For Claude Code:** Read this entire document before touching anything.
> Every finding includes the exact file, line number, and why the issue exists.
> Do NOT make changes speculatively — each section tells you exactly what to do.

---

## Project Orientation

STEM-ACT is a full-stack event submission and approval platform.

| Layer | Tech | Root path |
|---|---|---|
| Frontend | Next.js 15, MUI v6 | `stemApp/app/` |
| Backend | FastAPI (Python) | `stemApp/backend/api/main.py` |
| Database | PostgreSQL via Docker (port 5433) | `stemApp/db/` |

The project completed a backend migration: all API logic moved from Next.js route handlers
into FastAPI. `lib/api.js` provides an `apiUrl()` helper that all components should use to
call FastAPI. `lib/db.js` provides a direct PostgreSQL pool connection that should only be
used by files that have not yet been migrated — these are the problem areas.

---

## Finding 1 — `partners/[id]/page.js` bypasses FastAPI with a direct DB connection

**Severity:** HIGH
**File:** `stemApp/app/partners/[id]/page.js`
**Lines:** 1-5 (imports), 18-55 (`getOrganization`), 57-105 (`getOrganizationEvents`)

### Why this exists
This page was built before the FastAPI migration was complete. It uses `pool` from
`stemApp/lib/db.js` to query PostgreSQL directly from a Next.js server component — the
same pattern the migration was supposed to eliminate. It also uses `dbFeatures.js` (which
also uses `pool` directly) to detect whether schema migrations have been applied.

### What it currently does
- `getOrganization(orgId)` — queries `organizations` table, maps old status values
  (`approved -> active`, `rejected/inactive -> disabled`) inline with a SQL CASE statement
- `getOrganizationEvents(orgId)` — queries `events` joined with `tags`, handles both
  old and new schema shapes via `hasEventTagTables()` and `hasSplitContactNameColumns()`

### What FastAPI already provides
- `GET /api/organizations/{org_id}` (line 1125 of `main.py`) — exists but only returns
  `org_id`, `org_name`, `status`. Missing: contact fields, full status mapping
- `GET /api/events?org_id=X` (line 591 of `main.py`) — exists and returns full event data

### What needs to happen

**Step 1 — Expand the FastAPI endpoint first.**
Update `GET /api/organizations/{org_id}` in `main.py` (line 1125) to return full org detail:

```python
@app.get("/api/organizations/{org_id}")
def get_organization(org_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        text("""
            SELECT org_id, org_name, contact_first_name, contact_last_name,
                   contact_email, contact_phone, status
            FROM organizations
            WHERE org_id = :id
        """),
        {"id": org_id},
    ).mappings().first()
    if row is None:
        return JSONResponse({"success": False, "error": "Not found"}, status_code=404)
    return {"success": True, "organization": dict(row)}
```

**Step 2 — Convert `partners/[id]/page.js` to a client component.**
- Remove: `import pool from '@/lib/db'`
- Remove: `import { hasEventTagTables, hasSplitContactNameColumns } from '@/lib/dbFeatures'`
- Remove: `getOrganization()` and `getOrganizationEvents()` functions entirely
- Add `'use client'` directive at the top
- Replace data fetching with `fetch(apiUrl('/api/organizations/{id}'))` and
  `fetch(apiUrl('/api/events?org_id={id}'))`
- Remove the `STATUS_META` entries for `approved` and `rejected` — the only
  valid current values are: `pending`, `active`, `disabled`, `denied`

**Step 3 — Check whether `lib/db.js` can be removed.**
After migrating this page, verify nothing else imports it:
```bash
grep -rn "from '@/lib/db'\|require.*lib/db" stemApp/app/ stemApp/lib/
```
If only `dbFeatures.js` remains, that file can be deleted too since the schema
detection logic it provides is only needed by the direct-DB pattern being removed.

---

## Finding 2 — Stale enum values in the login endpoint

**Severity:** MEDIUM
**File:** `stemApp/backend/api/main.py`
**Line:** 319

### Why this exists
When the org status enum was migrated from the original schema values (`approved`,
`rejected`, `inactive`) to the adopted UI values (`active`, `disabled`), the login
endpoint's blocklist was updated to add the new values but the old ones were never removed.

### Current code (lines 316-320)
```python
if (
    user["role"] == UserRole.partner.value
    and user["organization_status"] in {"pending", "disabled", "inactive", "rejected"}
):
```

### What's wrong
- `"inactive"` — old schema value, no longer written to the DB
- `"rejected"` — old schema value for orgs, no longer written to the DB
- These are harmless today (no rows will have these values) but are misleading
  and could cause a future developer to think these are valid org states

### Correct code
```python
if (
    user["role"] == UserRole.partner.value
    and user["organization_status"] in {"pending", "disabled"}
):
```

Note: `"active"` is intentionally absent from this set — that is the status that
*allows* login. Only `pending` and `disabled` should block login.

---

## Finding 3 — Ghost value in `OrganizationStatus` enum

**Severity:** LOW
**File:** `stemApp/backend/api/main.py`
**Line:** 141-145

### Why this exists
The `OrganizationStatus` enum retained `approved` from the old schema alongside the
new `active` value when the migration was applied.

### Current enum
```python
class OrganizationStatus(str, Enum):
    approved = "approved"   # ghost: never used anywhere
    active = "active"
    pending = "pending"
    disabled = "disabled"
```

### What's wrong
`approved` is defined but never referenced in `main.py`. The adopted value is `active`.
Having both is a trap — a developer could use `OrganizationStatus.approved` thinking
it is valid and silently write `"approved"` to the DB instead of `"active"`.

### Fix
Remove the `approved = "approved"` line. Verify first:
```bash
grep -n "OrganizationStatus.approved" stemApp/backend/api/main.py
```
Expected result: no matches. If matches are found, update those call sites to use
`OrganizationStatus.active` before removing the enum entry.

---

## Finding 4 — Orphaned migration file in the wrong directory

**Severity:** LOW
**File:** `stemApp/backend/migrations/004_google_oauth.sql`
**Should be:** `stemApp/db/migrations/`

### Why this exists
The Google OAuth implementation plan created this migration in `backend/migrations/`
while every other migration lives in `db/migrations/`. It was a mistake in the plan.

### Overlap to be aware of
`stemApp/db/migrations/2026-03-16-email-verification.sql` already adds the
`email_verified` column. `004_google_oauth.sql` also adds `email_verified` but uses
`IF NOT EXISTS` so re-running is safe. The `google_sub` column and `password_hash`
nullable change are unique to `004_google_oauth.sql` and not covered elsewhere.

### What needs to happen
1. Move the file:
   `stemApp/backend/migrations/004_google_oauth.sql`
   -> `stemApp/db/migrations/2026-03-24-google-oauth.sql`
   (rename to follow the existing date-based naming convention)
2. Delete the now-empty `stemApp/backend/migrations/` directory
3. Check whether `Documentation/dockerSetup.md` or the README references the old path
   and update if so

---

## Finding 5 — Debug script in the wrong directory

**Severity:** LOW
**File:** `stemApp/app/check-users.js`
**Should be:** `stemApp/scripts/`

### Why this exists
A 10-line developer utility that queries the users table and prints results. It was
written during early development and left in `app/` where Next.js could accidentally
pick it up.

### What needs to happen
1. Verify it is not imported anywhere:
   ```bash
   grep -rn "check-users" stemApp/app/ stemApp/lib/
   ```
   Expected: no results other than the file itself.

2. Move and convert to ES module syntax to match the other scripts in `stemApp/scripts/`:
   - Move: `stemApp/app/check-users.js` -> `stemApp/scripts/check-users.mjs`
   - Change `const pool = require('./lib/db')` to `import pool from '../lib/db.js'`

---

## Finding 6 — `/signup` page is undocumented (needs team decision, not a code change)

**Severity:** NEEDS DECISION
**File:** `stemApp/app/signup/page.js`

### The situation
Two registration flows exist:
- `/register` — full partner registration with org fields, partner code, Google OAuth
- `/signup` — lightweight account creation (name, email, password only, no org fields)

`/signup` calls `POST /api/register/public` which exists in FastAPI (main.py line 551).
It is linked from `page.js` line 55 and included in `AdminNav` public routes line 13.
The `UserRole` enum includes `viewer = "viewer"` but no flow currently assigns that role.

### This is intentionally left as a team decision
Do not remove this page without confirming intent. Two valid paths:

**Keep it:** Add a code comment explaining it is for public viewer accounts (not partners).
Add `viewer` role handling to `RouteGuard.js` for any viewer-specific routes planned.

**Remove it:** Delete `signup/page.js`, remove the link from `page.js` line 55, remove
`/signup` from `AdminNav`'s `PUBLIC_ROUTES` (line 13), and confirm whether the
`POST /api/register/public` endpoint and `viewer` role in `UserRole` should also be removed.

---

## What Is Already Clean — Do Not Touch

| Area | Status |
|---|---|
| `stemApp/app/api/**` | Fully deleted — no dead Next.js routes remain |
| `EventStatus` enum | `denied` used correctly everywhere |
| `UserRole` and `InviteRole` enums | Consistent across backend and frontend |
| `RouteGuard.js` | Correctly handles `admin`, `super_admin`, `partner` |
| `db/migrations/` naming | Date-based, sequential, well-organized |
| Frontend `apiUrl()` usage | All components except `partners/[id]` use it correctly |

---

## Recommended Order of Changes

1. **Finding 3** — Remove ghost `approved` from `OrganizationStatus` (1-line delete, zero risk)
2. **Finding 2** — Fix stale values in login endpoint line 319 (1-line change, zero risk)
3. **Finding 5** — Move `check-users.js` to `scripts/` (file move + minor syntax change)
4. **Finding 4** — Move orphaned migration to `db/migrations/` (file move + rename)
5. **Finding 1** — Migrate `partners/[id]/page.js` off direct DB (expand FastAPI endpoint first, then convert the component — most involved change)
6. **Finding 6** — Confirm with the team before acting on this one
