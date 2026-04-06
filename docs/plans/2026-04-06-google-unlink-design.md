# Admin Google Account Unlink — Design Doc

**Feature:** Admin visibility and unlink for partner Google OAuth connections  
**Phase:** 4 — Auth Flows  
**Date:** 2026-04-06

---

## Overview

Admins need to see whether a partner user has a linked Google account and be able to unlink it. The primary use case is support: a partner loses access to their Google account and needs to revert to email/password login. Unlinking is reversible — the partner can re-link by signing in with Google again.

Linking is always user-initiated (requires the user to authenticate with Google). Admins can only revoke.

---

## Data & Backend

**Query change:** Add `google_sub IS NOT NULL AS google_linked` (boolean) to the users query in `stemApp/app/users/page.js`. The raw `google_sub` value is never exposed to the frontend.

**New endpoint:**
```
POST /api/users/{user_id}/unlink-google
```
- Sets `google_sub = NULL` for the given user
- Returns `{ success: true }` on success
- Returns 404 if user not found
- Returns 400 if `google_sub` is already null
- Restricted to admin/super_admin roles (same pattern as existing user endpoints)

---

## Frontend (UsersTable)

**New "Google" column** between Organization and Actions:
- `google_linked = true` → `<Chip label="Connected" color="success" size="small" />`
- `google_linked = false` → `—`

**"Unlink" button in Actions column:**
- Only rendered when `google_linked` is true
- Calls `POST /api/users/{user_id}/unlink-google`
- On success: optimistically flips `google_linked` to false on the row
- Uses existing toast system for success/error feedback
- No confirmation modal (action is reversible)

---

## Files Changed

| File | Change |
|------|--------|
| `stemApp/app/users/page.js` | Add `google_sub IS NOT NULL AS google_linked` to SQL query |
| `stemApp/app/users/UsersTable.js` | Add Google column + Unlink button |
| `stemApp/backend/api/main.py` | Add `POST /api/users/{user_id}/unlink-google` endpoint |
