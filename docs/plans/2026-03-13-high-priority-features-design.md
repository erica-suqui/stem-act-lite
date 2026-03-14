# High Priority Features Design
**Date:** 2026-03-13
**Branch:** submissionPage
**Features:** Email Service, Status Notifications, Password Reset, Event Comments

---

## Overview

Four interconnected features building on a shared mock email service layer. All features use Option B (modular email service first), so swapping to a real SMTP provider later requires only changing env vars and one file.

---

## Section 1 — Email Service Module

**New file:** `backend/api/email_service.py`

Single public function:
```python
send_email(to: str, subject: str, body: str) -> None
```

Behavior controlled by `EMAIL_MODE` env var:
- `mock` (default) — logs full email to console with `[EMAIL]` prefix so reset links can be copied manually
- `smtp` (future) — sends via SMTP using `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

All features import and call this one function. Switching to real email = set `EMAIL_MODE=smtp` and add SMTP creds to `.env`.

---

## Section 2 — Status Notifications (US007)

**Changed files:** `backend/api/main.py`

Hook into existing approve/deny endpoints using the already-present `BackgroundTasks` pattern (same as geocoding):

- **Approve** → email partner: "Your event *[title]* has been approved and is now published."
- **Deny** → email partner: "Your event *[title]* was denied. Admin comment: *[comment]*. You may reply through your dashboard."
- **Revoke** → no email (admin-only action)

Email address sourced from `submitter_email` on the events row (already stored). A row is inserted into the existing `notifications` table on each send with status `sent` or `failed`.

---

## Section 3 — Password Reset (US003)

### Backend

**New endpoints in `main.py`:**

- `POST /api/auth/forgot-password` — accepts `{ email }`, generates a secure random token, stores in `password_reset_tokens` table (expires in 1 hour), calls `send_email()` with reset link. Always returns `{ success: true }` (prevents user enumeration).
- `POST /api/auth/reset-password` — accepts `{ token, new_password }`, validates token (exists, not expired, not used), hashes password, updates user, marks token used.

**New DB table:**
```sql
CREATE TABLE password_reset_tokens (
  token       TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Frontend

**New pages:**
- `/forgot-password` — single email field form, shows generic success message on submit regardless of result
- `/reset-password?token=...` — new password + confirm password fields, calls reset endpoint, redirects to `/login` on success

**Changed files:**
- `app/components/LogIn.js` — add "Forgot password?" link below the login button

---

## Section 4 — Event Comments / Partner Reply (US006, US009)

### Backend

**New DB table:**
```sql
CREATE TABLE event_comments (
  comment_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('partner', 'admin')),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**New endpoints in `main.py`:**
- `GET /api/events/:id/comments` — returns all comments ordered by `created_at`
- `POST /api/events/:id/comments` — accepts `{ body, author_role }`, inserts comment, sends email notification:
  - Partner posts → email to `ADMIN_EMAIL` env var
  - Admin posts → email to partner's `submitter_email`

### Frontend

**Partner dashboard** (`app/partner/page.js`):
- On denied events, expand row to show admin comment + reply text field + Send button
- Toast confirmation on successful send

**Admin events table** (`app/components/EventsTable.js`):
- In the existing expanded "Details" row, show comment thread + text field to reply to partner

No new pages needed — both sides use existing expand/details UI.

---

## File Change Summary

| Feature | New files | Changed files |
|---|---|---|
| Email service | `backend/api/email_service.py` | `backend/.env` |
| Status notifications | — | `backend/api/main.py` |
| Password reset | `app/forgot-password/page.js`, `app/reset-password/page.js`, DB migration | `backend/api/main.py`, `app/components/LogIn.js` |
| Event comments | DB migration | `backend/api/main.py`, `app/partner/page.js`, `app/components/EventsTable.js` |

---

## Environment Variables Added

```
EMAIL_MODE=mock          # mock | smtp
ADMIN_EMAIL=admin@stemact.org
# Future SMTP vars:
# SMTP_HOST=
# SMTP_PORT=
# SMTP_USER=
# SMTP_PASS=
```
