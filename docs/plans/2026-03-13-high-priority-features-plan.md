# High Priority Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement email service, event status notifications, password reset, and partner/admin event comments for STEM-ACT.

**Architecture:** A shared `email_service.py` module provides mock email logging (real SMTP later via env var). Status notifications hook into existing FastAPI `BackgroundTasks`. Password reset uses a new `password_reset_tokens` table. Event comments use a new `event_comments` table with a comment thread UI on both the partner dashboard and admin events table.

**Tech Stack:** FastAPI + SQLAlchemy (raw SQL via `text()`), Next.js 14 App Router, MUI v5, Zod, PostgreSQL on port 5433.

---

## Task 1: Email Service Module

**Files:**
- Create: `stemApp/backend/api/email_service.py`
- Modify: `stemApp/backend/.env`

### Step 1: Add env vars to `.env`

Open `stemApp/backend/.env` and append:

```
EMAIL_MODE=mock
ADMIN_EMAIL=admin@stemact.org
```

### Step 2: Create `email_service.py`

Create `stemApp/backend/api/email_service.py`:

```python
import logging
import os
import smtplib
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> None:
    """
    Send an email. Behavior controlled by EMAIL_MODE env var:
      mock (default) — logs to console with [EMAIL] prefix
      smtp           — sends via SMTP using SMTP_HOST/PORT/USER/PASS env vars
    Never raises — email failure is always non-fatal.
    """
    mode = os.getenv("EMAIL_MODE", "mock").strip().lower()

    if mode == "smtp":
        try:
            host = os.getenv("SMTP_HOST", "localhost")
            port = int(os.getenv("SMTP_PORT", "587"))
            user = os.getenv("SMTP_USER", "")
            password = os.getenv("SMTP_PASS", "")

            msg = MIMEText(body, "plain")
            msg["Subject"] = subject
            msg["From"] = user
            msg["To"] = to

            with smtplib.SMTP(host, port) as server:
                server.starttls()
                server.login(user, password)
                server.sendmail(user, [to], msg.as_string())

            logger.info("[EMAIL] Sent to %s — %s", to, subject)
        except Exception as exc:
            logger.error("[EMAIL] Failed to send to %s — %s: %s", to, subject, exc)
    else:
        # Mock mode — log the full email so reset links can be copied manually
        logger.info(
            "\n[EMAIL MOCK]\nTo: %s\nSubject: %s\n\n%s\n[/EMAIL MOCK]",
            to, subject, body,
        )
        print(
            f"\n[EMAIL MOCK]\nTo: {to}\nSubject: {subject}\n\n{body}\n[/EMAIL MOCK]\n"
        )
```

### Step 3: Verify it imports cleanly

```bash
cd stemApp/backend
source .venv/bin/activate
python -c "from api.email_service import send_email; send_email('test@test.com', 'Hello', 'Body')"
```

Expected: prints `[EMAIL MOCK]` block to stdout, no errors.

### Step 4: Commit

```bash
git add stemApp/backend/api/email_service.py stemApp/backend/.env
git commit -m "feat: add mock email service module"
```

---

## Task 2: Database Migration (password_reset_tokens + event_comments)

**Files:**
- Create: `stemApp/db/migrations/2026-03-13-email-features.sql`

### Step 1: Create migration file

```sql
-- 2026-03-13-email-features.sql

BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token       TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_comments (
  comment_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('partner', 'admin')),
  body        TEXT NOT NULL CHECK (char_length(body) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id      ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_evt_comments_evt ON event_comments(event_id);

COMMIT;
```

### Step 2: Run the migration

```bash
psql postgresql://stemact_user:stemact_pass@127.0.0.1:5433/stemact \
  -f stemApp/db/migrations/2026-03-13-email-features.sql
```

Expected: `CREATE TABLE`, `CREATE TABLE`, `CREATE INDEX`, `CREATE INDEX`, `COMMIT`.

### Step 3: Verify tables exist

```bash
psql postgresql://stemact_user:stemact_pass@127.0.0.1:5433/stemact \
  -c "\d password_reset_tokens" \
  -c "\d event_comments"
```

Expected: both table schemas print without error.

### Step 4: Commit

```bash
git add stemApp/db/migrations/2026-03-13-email-features.sql
git commit -m "feat: add password_reset_tokens and event_comments tables"
```

---

## Task 3: Status Notifications on Approve/Deny

**Files:**
- Modify: `stemApp/backend/api/main.py`

The `approve_event` and `deny_event` endpoints already use `BackgroundTasks` for geocoding. Email sends follow the same pattern.

### Step 1: Add import at the top of `main.py`

Find the imports block (around line 1–16). Add:

```python
from .email_service import send_email
```

### Step 2: Update `approve_event` to fetch submitter email and notify

The current query at line ~505 only fetches `address, city`. Expand it to also fetch `title` and `submitter_email`:

```python
@app.post("/api/events/{event_id}/approve")
def approve_event(event_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    event_row = db.execute(
        text("SELECT address, city, title, submitter_email FROM events WHERE event_id = :event_id"),
        {"event_id": event_id},
    ).mappings().first()

    if event_row is None:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

    db.execute(
        text("""
            UPDATE events
            SET status = :status, admin_comment = NULL, reviewed_at = now()
            WHERE event_id = :event_id
        """),
        {"status": EventStatus.approved.value, "event_id": event_id},
    )
    db.commit()

    background_tasks.add_task(
        _geocode_event, event_id, event_row["address"], event_row["city"]
    )

    if event_row["submitter_email"]:
        background_tasks.add_task(
            send_email,
            event_row["submitter_email"],
            f"Your event has been approved: {event_row['title']}",
            f"Good news! Your event \"{event_row['title']}\" has been approved and is now published on the STEM-ACT events page.",
        )

    return {"success": True}
```

### Step 3: Update `deny_event` to notify

```python
@app.post("/api/events/{event_id}/deny")
def deny_event(event_id: int, payload: DenyEventRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not payload.comment.strip():
        return JSONResponse(
            {"success": False, "message": "Comment is required when denying an event"},
            status_code=400,
        )
    result = db.execute(
        text("""
            UPDATE events
            SET status = :status, admin_comment = :comment, reviewed_at = now()
            WHERE event_id = :event_id
            RETURNING event_id, title, submitter_email
        """),
        {"status": EventStatus.denied.value, "comment": payload.comment.strip(), "event_id": event_id},
    )
    row = result.mappings().first()
    db.commit()

    if row is None:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

    if row["submitter_email"]:
        background_tasks.add_task(
            send_email,
            row["submitter_email"],
            f"Your event was not approved: {row['title']}",
            f"Your event \"{row['title']}\" was not approved.\n\nAdmin comment: {payload.comment.strip()}\n\nYou may reply through your partner dashboard.",
        )

    return {"success": True}
```

### Step 4: Manually test approve/deny

- Start the backend: `cd stemApp/backend && source .venv/bin/activate && uvicorn api.main:app --reload --port 8000`
- Submit a test event via `/submit`, then approve or deny it in the admin dashboard
- Check the backend terminal — you should see the `[EMAIL MOCK]` block printed

### Step 5: Commit

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: send email notification on event approve/deny"
```

---

## Task 4: Password Reset — Backend Endpoints

**Files:**
- Modify: `stemApp/backend/api/main.py`

### Step 1: Add Pydantic models

Add these two models near the other request models (around line 130–200 in `main.py`):

```python
class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=1)

class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8)
```

### Step 2: Add `POST /api/auth/forgot-password` endpoint

```python
@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()

    user = db.execute(
        text("SELECT user_id FROM users WHERE lower(email) = :email LIMIT 1"),
        {"email": email},
    ).mappings().first()

    # Always return success to prevent user enumeration
    if user is None:
        return {"success": True}

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    db.execute(
        text("""
            INSERT INTO password_reset_tokens (token, user_id, expires_at)
            VALUES (:token, :user_id, :expires_at)
        """),
        {"token": token, "user_id": user["user_id"], "expires_at": expires_at},
    )
    db.commit()

    base_url = os.getenv("APP_BASE_URL", "http://localhost:3000/").rstrip("/")
    reset_link = f"{base_url}/reset-password?token={token}"

    background_tasks.add_task(
        send_email,
        email,
        "Reset your STEM-ACT password",
        f"Click the link below to reset your password. This link expires in 1 hour.\n\n{reset_link}\n\nIf you did not request a password reset, you can ignore this email.",
    )

    return {"success": True}
```

### Step 3: Add `POST /api/auth/reset-password` endpoint

```python
@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_row = db.execute(
        text("""
            SELECT token, user_id, expires_at, used_at
            FROM password_reset_tokens
            WHERE token = :token
            LIMIT 1
        """),
        {"token": payload.token},
    ).mappings().first()

    if token_row is None:
        return JSONResponse({"success": False, "message": "Invalid or expired reset link."}, status_code=400)

    if token_row["used_at"] is not None:
        return JSONResponse({"success": False, "message": "This reset link has already been used."}, status_code=400)

    if token_row["expires_at"] < datetime.now(timezone.utc):
        return JSONResponse({"success": False, "message": "This reset link has expired."}, status_code=400)

    password_hash = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()

    db.execute(
        text("UPDATE users SET password_hash = :hash WHERE user_id = :user_id"),
        {"hash": password_hash, "user_id": token_row["user_id"]},
    )
    db.execute(
        text("UPDATE password_reset_tokens SET used_at = now() WHERE token = :token"),
        {"token": payload.token},
    )
    db.commit()

    return {"success": True}
```

### Step 4: Test forgot-password endpoint manually

```bash
curl -s -X POST http://localhost:8000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}' | python -m json.tool
```

Expected: `{"success": true}` — and `[EMAIL MOCK]` block with reset link in the backend terminal.

### Step 5: Commit

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add forgot-password and reset-password endpoints"
```

---

## Task 5: Password Reset — Frontend Pages

**Files:**
- Create: `stemApp/app/forgot-password/page.js`
- Create: `stemApp/app/reset-password/page.js`
- Modify: `stemApp/app/components/LogIn.js`

### Step 1: Create `forgot-password/page.js`

```jsx
'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Stack,
} from '@mui/material';
import { apiUrl } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
      <Card elevation={4} sx={{ width: '100%', maxWidth: 420, p: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
            Reset Password
          </Typography>

          {submitted ? (
            <Alert severity="success">
              If that email is registered, a reset link has been sent. Check the server logs if you&apos;re in development.
            </Alert>
          ) : (
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </Typography>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                />
                <Button type="submit" variant="contained" fullWidth disabled={loading || !email}>
                  Send Reset Link
                </Button>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
```

### Step 2: Create `reset-password/page.js`

```jsx
'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Stack, CircularProgress,
} from '@mui/material';
import { apiUrl } from '@/lib/api';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return <Alert severity="error">Invalid reset link. Please request a new one.</Alert>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/login?reset=1');
      } else {
        setError(data.message || 'Reset failed. The link may have expired.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        <TextField
          label="New Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          helperText="Min 8 characters"
        />
        <TextField
          label="Confirm Password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          fullWidth
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" fullWidth disabled={loading}>
          {loading ? <CircularProgress size={22} color="inherit" /> : 'Reset Password'}
        </Button>
      </Stack>
    </Box>
  );
}

export default function ResetPasswordPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
      <Card elevation={4} sx={{ width: '100%', maxWidth: 420, p: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
            Set New Password
          </Typography>
          <Suspense fallback={<CircularProgress />}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </Box>
  );
}
```

### Step 3: Add "Forgot password?" link to `LogIn.js`

In `stemApp/app/components/LogIn.js`, find the `Register here` link section (around line 131–134) and add a "Forgot password?" link above it:

```jsx
<Typography variant="body2" align="center" color="text.secondary">
  <Link href="/forgot-password" style={{ color: 'inherit' }}>Forgot password?</Link>
</Typography>
<Typography variant="body2" align="center" color="text.secondary">
  Not registered?{' '}
  <Link href="/register" style={{ color: 'inherit' }}>Register here</Link>
</Typography>
```

### Step 4: Add "Password reset successfully" notice on login page

In `LogIn.js`, read `?reset=1` from `useSearchParams` and show a success alert:

```jsx
// At the top of the component, add:
const searchParams = useSearchParams();
const justReset = searchParams.get('reset') === '1';

// Inside the return, just above the form:
{justReset && (
  <Alert severity="success" sx={{ mb: 2 }}>
    Password reset successfully. Please log in.
  </Alert>
)}
```

Note: `LogIn.js` is already a client component. Wrap `LogIn` in a `<Suspense>` in `login/page.js` if Next.js warns about `useSearchParams`.

### Step 5: Manual test

1. Go to `/login` → click "Forgot password?"
2. Submit your email → check backend terminal for `[EMAIL MOCK]` with the reset link
3. Copy the link, open it in browser
4. Enter new password → should redirect to `/login?reset=1` with success message
5. Log in with the new password

### Step 6: Commit

```bash
git add stemApp/app/forgot-password/page.js \
        stemApp/app/reset-password/page.js \
        stemApp/app/components/LogIn.js \
        stemApp/app/login/page.js
git commit -m "feat: add forgot password and reset password pages"
```

---

## Task 6: Event Comments — Backend Endpoints

**Files:**
- Modify: `stemApp/backend/api/main.py`

### Step 1: Add Pydantic model

```python
class PostCommentRequest(BaseModel):
    body: str = Field(min_length=1)
    author_role: str = Field(pattern="^(partner|admin)$")
```

### Step 2: Add `GET /api/events/{event_id}/comments`

```python
@app.get("/api/events/{event_id}/comments")
def get_event_comments(event_id: int, db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT comment_id, event_id, author_role, body, created_at
            FROM event_comments
            WHERE event_id = :event_id
            ORDER BY created_at ASC
        """),
        {"event_id": event_id},
    ).mappings().all()
    return {"comments": [dict(r) for r in rows]}
```

### Step 3: Add `POST /api/events/{event_id}/comments`

```python
@app.post("/api/events/{event_id}/comments")
def post_event_comment(event_id: int, payload: PostCommentRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Verify event exists and get contact info for notification
    event_row = db.execute(
        text("SELECT title, submitter_email FROM events WHERE event_id = :event_id"),
        {"event_id": event_id},
    ).mappings().first()

    if event_row is None:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

    db.execute(
        text("""
            INSERT INTO event_comments (event_id, author_role, body)
            VALUES (:event_id, :author_role, :body)
        """),
        {"event_id": event_id, "author_role": payload.author_role, "body": payload.body.strip()},
    )
    db.commit()

    admin_email = os.getenv("ADMIN_EMAIL", "")
    title = event_row["title"]

    if payload.author_role == "partner" and admin_email:
        background_tasks.add_task(
            send_email,
            admin_email,
            f"Partner replied on event: {title}",
            f"A partner has replied to the comment thread for event \"{title}\".\n\nMessage:\n{payload.body.strip()}\n\nView in admin dashboard.",
        )
    elif payload.author_role == "admin" and event_row["submitter_email"]:
        background_tasks.add_task(
            send_email,
            event_row["submitter_email"],
            f"Admin replied on your event: {title}",
            f"An admin has replied to your event \"{title}\".\n\nMessage:\n{payload.body.strip()}\n\nView the full thread in your partner dashboard.",
        )

    return {"success": True}
```

### Step 4: Manual test

```bash
# Post a comment
curl -s -X POST http://localhost:8000/api/events/1/comments \
  -H "Content-Type: application/json" \
  -d '{"body": "Can you clarify the venue?", "author_role": "partner"}' | python -m json.tool

# Fetch comments
curl -s http://localhost:8000/api/events/1/comments | python -m json.tool
```

Expected: comment returned in list, `[EMAIL MOCK]` printed to backend terminal.

### Step 5: Commit

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add event comments endpoints with email notifications"
```

---

## Task 7: Event Comments — Partner Dashboard UI

**Files:**
- Modify: `stemApp/app/partner/page.js`

The partner dashboard already shows events in a table. Denied events have an Edit button. Add a comment thread below denied (and approved) events via an expandable detail section.

### Step 1: Add comment state and fetch logic

At the top of `PartnerDashboard`, add:

```jsx
const [commentThreads, setCommentThreads] = useState({}); // { [event_id]: comment[] }
const [commentInputs, setCommentInputs]   = useState({}); // { [event_id]: string }
const [expandedComments, setExpandedComments] = useState({}); // { [event_id]: bool }
const [sendingComment, setSendingComment] = useState(null);

const fetchComments = useCallback(async (eventId) => {
  const res = await fetch(apiUrl(`/api/events/${eventId}/comments`));
  if (!res.ok) return;
  const data = await res.json();
  setCommentThreads(prev => ({ ...prev, [eventId]: data.comments }));
}, []);

const toggleComments = async (eventId) => {
  const isOpen = expandedComments[eventId];
  setExpandedComments(prev => ({ ...prev, [eventId]: !isOpen }));
  if (!isOpen && !commentThreads[eventId]) {
    await fetchComments(eventId);
  }
};

const handleSendComment = async (eventId) => {
  const body = (commentInputs[eventId] || '').trim();
  if (!body) return;
  setSendingComment(eventId);
  try {
    const res = await fetch(apiUrl(`/api/events/${eventId}/comments`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, author_role: 'partner' }),
    });
    if (res.ok) {
      setCommentInputs(prev => ({ ...prev, [eventId]: '' }));
      await fetchComments(eventId);
      addToast('Reply sent.', 'success');
    } else {
      addToast('Failed to send reply.', 'error');
    }
  } finally {
    setSendingComment(null);
  }
};
```

### Step 2: Add comment thread imports

Add to the MUI imports at the top of `partner/page.js`:

```jsx
import {
  // ...existing imports...
  Collapse, Divider, TextField as MuiTextField, Stack as MuiStack,
} from '@mui/material';
```

(Use the existing imports — just add `Collapse`, `Divider`, `TextField`, `Stack` if not already present.)

### Step 3: Add comment thread UI below each event row

Inside the `events.map()` block, after the edit `<Button>`, add a "Comments" toggle button and the collapsible thread:

```jsx
<TableRow key={event.event_id}>
  {/* ...existing cells... */}
  <TableCell>
    {canEdit(event) && (
      <Button variant="outlined" size="small" onClick={() => setEditEvent(event)}>
        Edit
      </Button>
    )}
    <Button
      size="small"
      variant="text"
      sx={{ ml: 1 }}
      onClick={() => toggleComments(event.event_id)}
    >
      {expandedComments[event.event_id] ? 'Hide Thread' : 'Comments'}
    </Button>
  </TableCell>
</TableRow>

{/* Comment thread row */}
{expandedComments[event.event_id] && (
  <TableRow>
    <TableCell colSpan={5} sx={{ pt: 0, pb: 1, bgcolor: 'grey.50' }}>
      <Collapse in={expandedComments[event.event_id]}>
        <Box sx={{ p: 1.5 }}>
          {(commentThreads[event.event_id] || []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">No comments yet.</Typography>
          ) : (
            (commentThreads[event.event_id] || []).map(c => (
              <Box key={c.comment_id} sx={{ mb: 1, p: 1, bgcolor: c.author_role === 'admin' ? 'primary.50' : 'white', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" fontWeight={600} color={c.author_role === 'admin' ? 'primary.dark' : 'text.primary'}>
                  {c.author_role === 'admin' ? 'Admin' : 'You'}
                </Typography>
                <Typography variant="body2">{c.body}</Typography>
              </Box>
            ))
          )}
          <Divider sx={{ my: 1 }} />
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <TextField
              size="small"
              multiline
              rows={2}
              fullWidth
              placeholder="Reply to admin..."
              value={commentInputs[event.event_id] || ''}
              onChange={e => setCommentInputs(prev => ({ ...prev, [event.event_id]: e.target.value }))}
            />
            <Button
              variant="contained"
              size="small"
              disabled={sendingComment === event.event_id || !commentInputs[event.event_id]?.trim()}
              onClick={() => handleSendComment(event.event_id)}
            >
              Send
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </TableCell>
  </TableRow>
)}
```

### Step 4: Add missing MUI imports

Make sure these are imported in `partner/page.js`:

```jsx
import {
  Box, Button, Chip, CircularProgress, Collapse, Divider,
  Dialog, DialogContent, DialogTitle, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
```

### Step 5: Manual test

1. Log in as a partner, go to `/partner`
2. Find a denied event, click "Comments"
3. Type a reply and click Send
4. Verify the comment appears in the thread
5. Check backend terminal for `[EMAIL MOCK]` sent to admin

### Step 6: Commit

```bash
git add stemApp/app/partner/page.js
git commit -m "feat: add comment thread UI to partner dashboard"
```

---

## Task 8: Event Comments — Admin Events Table UI

**Files:**
- Modify: `stemApp/app/components/EventsTable.js`

The admin already has an expandable "Details" row per event. Add the comment thread and reply field inside that expanded row.

### Step 1: Add comment state and fetch logic to `EventsTable`

At the top of `EventsTable` component (near existing state declarations), add:

```jsx
const [commentThreads, setCommentThreads]     = useState({});
const [commentInputs, setCommentInputs]       = useState({});
const [sendingComment, setSendingComment]     = useState(null);

const fetchComments = useCallback(async (eventId) => {
  const res = await fetch(apiUrl(`/api/events/${eventId}/comments`));
  if (!res.ok) return;
  const data = await res.json();
  setCommentThreads(prev => ({ ...prev, [eventId]: data.comments }));
}, []);

const handleAdminComment = useCallback(async (eventId) => {
  const body = (commentInputs[eventId] || '').trim();
  if (!body) return;
  setSendingComment(eventId);
  try {
    const res = await fetch(apiUrl(`/api/events/${eventId}/comments`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, author_role: 'admin' }),
    });
    if (res.ok) {
      setCommentInputs(prev => ({ ...prev, [eventId]: '' }));
      await fetchComments(eventId);
      addToast('Reply sent to partner.', 'success');
    } else {
      addToast('Failed to send reply.', 'error');
    }
  } finally {
    setSendingComment(null);
  }
}, [commentInputs, fetchComments, addToast]);
```

### Step 2: Load comments when Details row is expanded

In the `setExpandedId` toggle handler (the "Details" button `onClick`), fetch comments when opening:

```jsx
onClick={() => {
  const next = isExpanded ? null : event.event_id;
  setExpandedId(next);
  if (next && !commentThreads[next]) {
    fetchComments(next);
  }
}}
```

### Step 3: Add comment thread to the expanded detail row

Inside the expanded `<Collapse>` box (currently shows description and tags), append the comment thread after the existing content:

```jsx
<Divider sx={{ my: 1.5 }} />
<Typography variant="subtitle2" fontWeight={600} gutterBottom>Comment Thread</Typography>
{(commentThreads[event.event_id] || []).length === 0 ? (
  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>No comments yet.</Typography>
) : (
  (commentThreads[event.event_id] || []).map(c => (
    <Box key={c.comment_id} sx={{ mb: 1, p: 1, bgcolor: c.author_role === 'admin' ? 'primary.50' : 'grey.100', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="caption" fontWeight={600} color={c.author_role === 'admin' ? 'primary.dark' : 'text.secondary'}>
        {c.author_role === 'admin' ? 'You (Admin)' : 'Partner'}
      </Typography>
      <Typography variant="body2">{c.body}</Typography>
    </Box>
  ))
)}
<Stack direction="row" spacing={1} alignItems="flex-end" sx={{ mt: 1 }}>
  <TextField
    size="small"
    multiline
    rows={2}
    fullWidth
    placeholder="Reply to partner..."
    value={commentInputs[event.event_id] || ''}
    onChange={e => setCommentInputs(prev => ({ ...prev, [event.event_id]: e.target.value }))}
  />
  <Button
    variant="contained"
    size="small"
    disabled={sendingComment === event.event_id || !commentInputs[event.event_id]?.trim()}
    onClick={() => handleAdminComment(event.event_id)}
  >
    Send
  </Button>
</Stack>
```

### Step 4: Add missing MUI imports

Make sure `Divider`, `Stack`, and `TextField` are imported in `EventsTable.js` (check the existing import block at the top — add any that are missing).

### Step 5: Manual test

1. Log in as admin, go to the dashboard
2. Click "Details" on any event
3. Send a reply from the admin side
4. Log in as partner — click "Comments" on the same event and verify the admin's message appears
5. Check backend terminal for `[EMAIL MOCK]` sent to partner email

### Step 6: Commit

```bash
git add stemApp/app/components/EventsTable.js
git commit -m "feat: add comment thread to admin events table details row"
```

---

## Done

All four high-priority features are implemented:

| Feature | Status |
|---|---|
| Mock email service | ✅ |
| Status notifications on approve/deny | ✅ |
| Password reset (forgot + reset pages) | ✅ |
| Event comment threads (partner + admin) | ✅ |
