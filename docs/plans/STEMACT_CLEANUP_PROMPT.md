# STEM-ACT Repo Cleanup — Claude Code Prompt

Paste this directly into Claude Code. It references the full audit in `STEMACT_CLEANUP_REFERENCE.md`.

---

## Prompt

I need you to clean up this repo based on a pre-analyzed audit. Before doing anything,
read `STEMACT_CLEANUP_REFERENCE.md` in full — it has the exact files, line numbers, and
context for every change. Do not make any changes that are not listed there.

Work through the findings in this order. Complete and verify each one before moving to the next.

---

### Task 1 — Remove ghost enum value (Finding 3)

**File:** `stemApp/backend/api/main.py`, line ~141

In the `OrganizationStatus` class, remove the line `approved = "approved"`.
Before removing it, run:
```bash
grep -n "OrganizationStatus.approved" stemApp/backend/api/main.py
```
If there are any matches, show them to me before proceeding. If there are none, remove
the line and confirm the enum now reads: `active`, `pending`, `disabled` only.

---

### Task 2 — Fix stale login blocklist values (Finding 2)

**File:** `stemApp/backend/api/main.py`, line 319

The `organization_status` check in the login endpoint includes `"inactive"` and
`"rejected"` which are old schema values no longer used. Change:
```python
and user["organization_status"] in {"pending", "disabled", "inactive", "rejected"}
```
to:
```python
and user["organization_status"] in {"pending", "disabled"}
```
Show me the diff before confirming.

---

### Task 3 — Move debug script out of `app/` (Finding 5)

**File:** `stemApp/app/check-users.js`

First verify it is not imported anywhere:
```bash
grep -rn "check-users" stemApp/app/ stemApp/lib/
```
If there are no results (other than the file itself), do the following:
1. Copy the file to `stemApp/scripts/check-users.mjs`
2. In the new file, change `const pool = require('./lib/db')` to
   `import pool from '../lib/db.js'`
3. Delete `stemApp/app/check-users.js`

---

### Task 4 — Move orphaned migration to the correct directory (Finding 4)

**File:** `stemApp/backend/migrations/004_google_oauth.sql`

1. Copy the file to `stemApp/db/migrations/2026-03-24-google-oauth.sql`
   (rename to follow the existing date-based naming convention)
2. Delete `stemApp/backend/migrations/004_google_oauth.sql`
3. Delete the now-empty `stemApp/backend/migrations/` directory
4. Search for any references to the old path in documentation:
   ```bash
   grep -rn "backend/migrations" stemApp/ Documentation/
   ```
   If found, update those references to point to `db/migrations/`.

---

### Task 5 — Migrate `partners/[id]/page.js` off the direct DB connection (Finding 1)

This is the most involved change. Do it in two steps.

**Step 5a — Expand the FastAPI endpoint**

In `stemApp/backend/api/main.py`, find `GET /api/organizations/{org_id}` (around line 1125).
It currently only selects `org_id, org_name, status`. Expand the SELECT to also return
`contact_first_name`, `contact_last_name`, `contact_email`, `contact_phone`.

Restart the backend and confirm the expanded response with:
```bash
curl -s http://localhost:8000/api/organizations/1 | python3 -m json.tool
```

**Step 5b — Convert `partners/[id]/page.js` to a client component**

Rewrite `stemApp/app/partners/[id]/page.js` to:
- Add `'use client'` at the top
- Remove `import pool from '@/lib/db'`
- Remove `import { hasEventTagTables, hasSplitContactNameColumns } from '@/lib/dbFeatures'`
- Remove the `getOrganization()` and `getOrganizationEvents()` functions
- Use `fetch(apiUrl('/api/organizations/${id}'))` for org data
- Use `fetch(apiUrl('/api/events?org_id=${id}'))` for event data
- Keep all existing JSX and display logic intact — only the data fetching changes
- In `STATUS_META`, remove the `approved` and `rejected` entries. Valid entries are:
  `pending`, `active`, `disabled`, `denied`

After the conversion, verify:
```bash
grep -rn "from '@/lib/db'\|require.*lib/db" stemApp/app/ stemApp/lib/
```
If `lib/db.js` and `lib/dbFeatures.js` are no longer imported anywhere, flag them
for deletion but do not delete without confirming with me first.

---

### Task 6 — Pause for team decision (Finding 6)

Do NOT touch `stemApp/app/signup/page.js` yet. Instead, show me a summary of:
- What the page does
- Where it is linked from
- Whether the `viewer` role in `UserRole` enum is used anywhere else

I will confirm the team's decision before you take any action on this file.
