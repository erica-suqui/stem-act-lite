# Google OAuth 2.0 Auth Flows — Design

**Date:** 2026-03-24
**Tickets:** STEMACT-405, STEMACT-406, STEMACT-407, STEMACT-408
**Epic:** Google OAuth Auth Flows
**Approach:** GIS Sign In With Google button + backend JWT verification (Option B)

---

## Overview

Add Google OAuth 2.0 login and registration for partners alongside the existing email/password flow. Partners can use either method. Google Identity Services (GIS) JavaScript SDK handles the frontend button; the backend verifies the returned JWT credential against Google's tokeninfo endpoint before trusting any identity claims.

---

## Database Changes

Migration against the Docker PostgreSQL instance (port 5433):

- `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL` — allows Google-only accounts with no password
- `ALTER TABLE users ADD COLUMN google_sub TEXT UNIQUE` — stores Google's immutable `sub` claim
- `ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE` — Google-authed users are set to `true` on creation; email/password users remain on existing email verification flow

---

## Backend

### New endpoints

**`POST /api/auth/google/login`**
- Body: `{ credential: "<GIS ID token JWT>" }`
- Verifies token: `GET https://oauth2.googleapis.com/tokeninfo?id_token=<token>` via `httpx`
- Validates `aud` == `GOOGLE_CLIENT_ID` env var
- Extracts `sub`, `email` from tokeninfo response
- Looks up user by `google_sub`, then falls back to `email`
  - If found by email but `google_sub` is NULL: links the account by setting `google_sub`
  - If not found: returns `{ success: false, new_user: true, credential: "<token>" }` so frontend can redirect to registration
- On success: returns `{ success: true, userID, role, orgId }` — same shape as existing `/api/login`
- Checks org status (pending/disabled blocks login) same as existing login

**`POST /api/auth/google/register`**
- Body: `{ credential: "<GIS ID token JWT>", phone: str, orgName: str }`
- Re-verifies credential with Google tokeninfo (never trust frontend-decoded claims)
- Extracts `sub`, `email`, `given_name`, `family_name`
- Checks email uniqueness; returns 409 if already registered
- Creates org with status `pending`, creates user with `google_sub` set and `password_hash` NULL, `email_verified = true`
- Returns `{ success: true }`

### Environment
Add to `backend/api/.env`:
```
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
```

### Dependency
No new Python packages needed — `httpx` is already in `requirements.txt`. Token verification uses Google's public tokeninfo endpoint.

---

## Frontend

### Environment
Add to `stemApp/.env.local`:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
```

### Login page (`LogIn.js`)

1. Load GIS script via `next/script`: `https://accounts.google.com/gsi/client`
2. Initialize `google.accounts.id` with `client_id` and a `handleGoogleCredential` callback
3. Render a "Continue with Google" button below the existing form, separated by an "or" divider
4. `handleGoogleCredential(response)`:
   - Calls `POST /api/auth/google/login` with `{ credential: response.credential }`
   - On `success: true` → store `userID/role/orgId` in `localStorage` (if rememberMe) or `sessionStorage` → redirect to dashboard
   - On `new_user: true` → store credential in `sessionStorage` → redirect to `/register?google=1`
   - On error → show error Alert
5. Add link below the form: "Trouble accessing your Google account? Google Account Recovery" (links to `https://accounts.google.com/signin/recovery`) — covers STEMACT-408

### Register page (`RegisterForm.js`)

When `?google=1` query param is present:
1. Read credential from `sessionStorage`; if missing, redirect to `/login`
2. Decode JWT payload client-side (base64, no verification — display only) to pre-fill `firstName`, `lastName`, `email`
3. Hide `password` and `confirmPassword` fields
4. Show `phone` and `orgName` fields as required
5. On submit: call `POST /api/auth/google/register` with `{ credential, phone, orgName }`
6. On success: show "Would you like to add an event now?" dialog
   - Yes → redirect to `/submit`
   - No → redirect to `/login`
7. Also add "Continue with Google" button on the standard (non-`?google=1`) register page for partners who start there directly — same flow as login page button

---

## Session Persistence (STEMACT-407)

- "Remember Me" checkbox on login applies to Google OAuth login identically: checked → `localStorage`, unchecked → `sessionStorage`
- Sessions are stateless on the backend — no server-side session store
- On expired/missing session, `RouteGuard` redirects to `/login` — no changes needed
- GIS One Tap will auto-prompt re-authentication if the user is still signed into Google, making re-auth seamless

---

## Account Recovery (STEMACT-408)

- Visible link on the login page below the form: "Trouble accessing your Google account? [Google Account Recovery](https://accounts.google.com/signin/recovery)"
- No backend work required — recovery is fully delegated to Google

---

## What Does NOT Change

- Existing email/password login and registration flows are untouched
- Admin and super_admin roles do not use Google OAuth
- Org approval workflow (pending → admin approves → active) is identical for Google-registered partners
- `RouteGuard`, `PartnerAppBar`, `SignOutButton` require no changes

---

## Security Notes

- Backend always re-verifies the GIS JWT with Google's tokeninfo endpoint — frontend-decoded claims are display-only
- `aud` claim is validated against `GOOGLE_CLIENT_ID` to prevent token substitution attacks
- `google_sub` uniqueness constraint prevents duplicate account creation
- `password_hash` NULL is only valid when `google_sub` is set (enforced in application logic; could add a DB check constraint if desired)
