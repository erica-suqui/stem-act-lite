# Google OAuth 2.0 Auth Flows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "Continue with Google" login and registration for partners alongside the existing email/password flow, covering STEMACT-405 through STEMACT-408.

**Architecture:** GIS Sign In With Google button on the frontend returns a signed JWT credential; the backend verifies it against Google's tokeninfo endpoint using `httpx` (already a dependency), then creates/finds the user. Two new endpoints: `POST /api/auth/google/login` and `POST /api/auth/google/register`. DB gets three column changes to support passwordless OAuth accounts.

**Tech Stack:** FastAPI + SQLAlchemy (raw SQL, no ORM models), Next.js 15, MUI v6, Google Identity Services (GIS) JavaScript SDK, PostgreSQL on port 5433.

---

## Task 1: DB Migration — Add OAuth Columns

**Files:**
- Create: `stemApp/db/migrations/2026-03-24-google-oauth.sql`

**Step 1: Write the migration SQL**

Create `stemApp/db/migrations/2026-03-24-google-oauth.sql`:

```sql
-- Make password_hash nullable (Google OAuth users have no password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Store Google's immutable user identifier
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE users ADD CONSTRAINT users_google_sub_key UNIQUE (google_sub);

-- Track email verification status (Google users are pre-verified)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
```

**Step 2: Run the migration**

```bash
PGPASSWORD=stemact_pass psql -h 127.0.0.1 -p 5433 -U stemact_user -d stemact -f stemApp/db/migrations/2026-03-24-google-oauth.sql
```

Expected output:
```
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
```

**Step 3: Verify the schema**

```bash
PGPASSWORD=stemact_pass psql -h 127.0.0.1 -p 5433 -U stemact_user -d stemact -c "\d users"
```

Confirm: `password_hash` shows no `not null`, `google_sub` and `email_verified` columns exist.

**Step 4: Commit**

```bash
git add stemApp/db/migrations/2026-03-24-google-oauth.sql
git commit -m "feat: add google_sub and email_verified columns, make password_hash nullable"
```

---

## Task 2: Backend Environment Config

**Files:**
- Modify: `stemApp/backend/api/.env`

**Step 1: Add the Google Client ID env var**

Append to `stemApp/backend/api/.env`:

```
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
```

Replace `<your-client-id>` with the actual client ID from Google Cloud Console (OAuth 2.0 Client IDs section). The client type should be "Web application".

**Step 2: Verify it loads**

```bash
cd stemApp/backend && python -c "import os; from dotenv import load_dotenv; load_dotenv('api/.env'); print(os.getenv('GOOGLE_CLIENT_ID'))"
```

Expected: prints the client ID (not `None`).

> Note: Do not commit `.env` to git. It is already in `.gitignore`.

---

## Task 3: Backend — Google Login Endpoint

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add the Pydantic model**

After the `LoginRequest` class (around line 192), add:

```python
class GoogleAuthRequest(BaseModel):
    credential: str = Field(min_length=1)

class GoogleRegisterRequest(BaseModel):
    credential: str = Field(min_length=1)
    phone: str = Field(min_length=10)
    orgName: str = Field(min_length=1)
```

**Step 2: Add the helper function**

After the `_has_event_geocode_columns` function (around line 130), add:

```python
def _verify_google_token(credential: str) -> dict:
    """
    Verifies a GIS ID token with Google's tokeninfo endpoint.
    Returns the token claims dict on success.
    Raises ValueError with a user-facing message on failure.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise ValueError("Google OAuth is not configured on this server")

    resp = httpx.get(
        "https://oauth2.googleapis.com/tokeninfo",
        params={"id_token": credential},
        timeout=10.0,
    )
    if resp.status_code != 200:
        raise ValueError("Invalid or expired Google credential")

    claims = resp.json()

    if claims.get("aud") != client_id:
        raise ValueError("Google credential was not issued for this application")

    return claims
```

**Step 3: Add the login endpoint**

After the existing `@app.post("/api/login")` block (after line 327), add:

```python
@app.post("/api/auth/google/login")
def google_login(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        claims = _verify_google_token(payload.credential)
    except ValueError as exc:
        return JSONResponse({"success": False, "error": str(exc)}, status_code=401)

    google_sub = claims["sub"]
    email = claims.get("email", "").strip().lower()

    # Look up user by google_sub first, then fall back to email
    user = db.execute(
        text("""
            SELECT u.user_id, u.role, u.org_id, u.google_sub,
                   o.status AS organization_status
            FROM users u
            LEFT JOIN organizations o ON o.org_id = u.org_id
            WHERE u.google_sub = :google_sub
               OR lower(u.email) = lower(:email)
            LIMIT 1
        """),
        {"google_sub": google_sub, "email": email},
    ).mappings().first()

    if user is None:
        # New user — frontend should redirect to registration
        return JSONResponse({"success": False, "new_user": True}, status_code=404)

    # Link google_sub if this account was previously email/password only
    if user["google_sub"] is None:
        db.execute(
            text("UPDATE users SET google_sub = :sub WHERE user_id = :uid"),
            {"sub": google_sub, "uid": user["user_id"]},
        )
        db.commit()

    if (
        user["role"] == UserRole.partner.value
        and user["organization_status"] in {"pending", "disabled", "inactive", "rejected"}
    ):
        return JSONResponse(
            {"success": False, "error": "This partner account is not active yet"},
            status_code=403,
        )

    return {
        "success": True,
        "userID": user["user_id"],
        "role": user["role"],
        "orgId": user["org_id"],
    }
```

**Step 4: Restart the backend and smoke-test**

```bash
cd stemApp/backend && uvicorn api.main:app --reload --port 8000
```

In a second terminal:
```bash
curl -s -X POST http://localhost:8000/api/auth/google/login \
  -H "Content-Type: application/json" \
  -d '{"credential": "bad_token"}' | python3 -m json.tool
```

Expected: `{"success": false, "error": "Invalid or expired Google credential"}`

**Step 5: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add POST /api/auth/google/login endpoint"
```

---

## Task 4: Backend — Google Register Endpoint

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add the registration endpoint**

After the `google_login` endpoint added in Task 3, add:

```python
@app.post("/api/auth/google/register")
def google_register(payload: GoogleRegisterRequest, db: Session = Depends(get_db)):
    try:
        claims = _verify_google_token(payload.credential)
    except ValueError as exc:
        return JSONResponse({"success": False, "error": str(exc)}, status_code=401)

    google_sub = claims["sub"]
    email = claims.get("email", "").strip().lower()
    first_name = claims.get("given_name", "").strip()
    last_name = claims.get("family_name", "").strip()
    org_name = payload.orgName.strip()
    phone = payload.phone.strip()
    user_name = email.split("@")[0] if "@" in email else email

    # Duplicate check
    existing = db.execute(
        text("""
            SELECT user_id FROM users
            WHERE google_sub = :sub OR lower(email) = lower(:email)
            LIMIT 1
        """),
        {"sub": google_sub, "email": email},
    ).first()
    if existing is not None:
        return JSONResponse(
            {"success": False, "error": "An account with this Google account already exists"},
            status_code=409,
        )

    try:
        org_result = db.execute(
            text("""
                INSERT INTO organizations (
                    org_name, contact_first_name, contact_last_name,
                    contact_email, contact_phone, status
                )
                VALUES (
                    :org_name, :first_name, :last_name,
                    :email, :phone, :status
                )
                RETURNING org_id
            """),
            {
                "org_name": org_name,
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "phone": phone,
                "status": OrganizationStatus.pending.value,
            },
        )
        org_id = org_result.mappings().first()["org_id"]

        db.execute(
            text("""
                INSERT INTO users (email, password_hash, role, org_id, user_name, google_sub, email_verified)
                VALUES (:email, NULL, :role, :org_id, :user_name, :google_sub, TRUE)
            """),
            {
                "email": email,
                "role": UserRole.partner.value,
                "org_id": org_id,
                "user_name": user_name,
                "google_sub": google_sub,
            },
        )
        db.commit()
        return {"success": True}
    except Exception as exc:
        db.rollback()
        return JSONResponse({"success": False, "error": str(exc)}, status_code=500)
```

**Step 2: Smoke-test**

```bash
curl -s -X POST http://localhost:8000/api/auth/google/register \
  -H "Content-Type: application/json" \
  -d '{"credential": "bad_token", "phone": "8031234567", "orgName": "Test Org"}' | python3 -m json.tool
```

Expected: `{"success": false, "error": "Invalid or expired Google credential"}`

**Step 3: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add POST /api/auth/google/register endpoint"
```

---

## Task 5: Frontend Environment Config

**Files:**
- Modify: `stemApp/.env.local`

**Step 1: Add the public Google Client ID**

Append to `stemApp/.env.local`:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
```

Use the same client ID from Task 2. The `NEXT_PUBLIC_` prefix makes it available in browser-side code.

**Step 2: Verify**

In any Next.js component you can log `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID` — but just ensure the value is set correctly in the file.

> Note: `.env.local` is already gitignored.

---

## Task 6: Frontend — Update LogIn.js (STEMACT-405, STEMACT-407, STEMACT-408)

**Files:**
- Modify: `stemApp/app/components/LogIn.js`

**Step 1: Replace the full file contents**

Replace `stemApp/app/components/LogIn.js` with:

```javascript
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import * as z from 'zod';
import { apiUrl } from '@/lib/api';
import Script from 'next/script';
import {
  Box, Card, CardContent, Checkbox, Typography, TextField,
  Button, Alert, Stack, FormControlLabel, Divider
} from '@mui/material';
import Link from 'next/link';


export default function LogIn() {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [errors, setErrors] = useState({});
    const router = useRouter();
    const searchParams = useSearchParams();
    const justReset = searchParams.get('reset') === '1';
    const [loginError, setLoginError] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const googleButtonRef = useRef(null);

    const LogInSchema = z.object({
        email: z.string().email().min(1, "Missing Email"),
        password: z.string().min(1, "Missing Password"),
    });

    // Initialise GIS once the script has loaded
    const initGoogleSignIn = () => {
        if (!window.google || !googleButtonRef.current) return;
        window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
            callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'outline',
            size: 'large',
            width: googleButtonRef.current.offsetWidth || 360,
            text: 'continue_with',
        });
    };

    const handleGoogleCredential = async (response) => {
        setLoginError('');
        try {
            const res = await fetch(apiUrl('/api/auth/google/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json();

            if (data.success) {
                const storage = rememberMe ? localStorage : sessionStorage;
                storage.setItem('userID', data.userID);
                storage.setItem('role', data.role);
                storage.setItem('orgId', data.orgId);
                const roleRoutes = {
                    partner: '/partner',
                    admin: '/superAdminDashboard',
                    super_admin: '/superAdminDashboard',
                };
                router.push(roleRoutes[data.role] || '/');
            } else if (data.new_user) {
                // Store credential temporarily so register page can use it
                sessionStorage.setItem('google_credential', response.credential);
                router.push('/register?google=1');
            } else {
                setLoginError(data.error || 'Google sign-in failed');
            }
        } catch {
            setLoginError('Something went wrong');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (loginError) setLoginError('');
        if (errors[name]) {
            setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const userData = LogInSchema.safeParse(formData);
        if (!userData.success) { setErrors(userData.error.format()); return; }

        try {
            const response = await fetch(apiUrl('/api/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await response.json();
            if (data.success) {
                const storage = rememberMe ? localStorage : sessionStorage;
                storage.setItem('userID', data.userID);
                storage.setItem('role', data.role);
                storage.setItem('orgId', data.orgId);
                const roleRoutes = {
                    partner: '/partner',
                    admin: '/superAdminDashboard',
                    super_admin: '/superAdminDashboard',
                };
                router.push(roleRoutes[data.role] || '/');
            } else {
                setLoginError(data.error || 'Login failed');
            }
        } catch {
            setLoginError('Something went wrong');
        }
    };

    return (
        <>
            <Script
                src="https://accounts.google.com/gsi/client"
                onLoad={initGoogleSignIn}
                strategy="afterInteractive"
            />
            <Box component="main" sx={{
                minHeight: '100vh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', bgcolor: 'background.default', px: 2,
            }}>
                <Card elevation={4} sx={{ width: '100%', maxWidth: 420, p: 2 }}>
                    <CardContent>
                        <Typography variant="h5" component="h1" align="center" fontWeight={700} color="primary.dark" gutterBottom>
                            Sign In
                        </Typography>
                        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
                            STEM-ACT
                        </Typography>
                        {justReset && (
                            <Alert severity="success" sx={{ mb: 2 }}>
                                Password reset successfully. Please log in.
                            </Alert>
                        )}
                        <Box component="form" onSubmit={handleFormSubmit} noValidate>
                            <Stack spacing={2}>
                                <TextField
                                    label="Email" name="email" type="email"
                                    value={formData.email} onChange={handleChange}
                                    fullWidth required
                                    error={Boolean(errors.email)}
                                    helperText={errors.email?._errors?.[0]}
                                />
                                <TextField
                                    label="Password" name="password" type="password"
                                    value={formData.password} onChange={handleChange}
                                    fullWidth required
                                    error={Boolean(errors.password)}
                                    helperText={errors.password?._errors?.[0]}
                                />
                                {loginError && <Alert severity="error">{loginError}</Alert>}
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={rememberMe}
                                            onChange={e => setRememberMe(e.target.checked)}
                                        />
                                    }
                                    label="Remember Me"
                                />
                                <Button type="submit" variant="contained" fullWidth size="large">
                                    Log In
                                </Button>
                                <Typography variant="body2" align="center" color="text.secondary">
                                    <Link href="/forgot-password" style={{ color: 'inherit' }}>Forgot password?</Link>
                                </Typography>
                                <Divider>
                                    <Typography variant="caption" color="text.secondary">or</Typography>
                                </Divider>
                                {/* GIS renders the Google button into this div */}
                                <Box ref={googleButtonRef} sx={{ display: 'flex', justifyContent: 'center' }} />
                                <Typography variant="body2" align="center" color="text.secondary">
                                    Not registered?{' '}
                                    <Link href="/register" style={{ color: 'inherit' }}>Register here</Link>
                                </Typography>
                                <Typography variant="body2" align="center" color="text.secondary">
                                    Trouble accessing your Google account?{' '}
                                    <a
                                        href="https://accounts.google.com/signin/recovery"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: 'inherit' }}
                                    >
                                        Google Account Recovery
                                    </a>
                                </Typography>
                            </Stack>
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        </>
    );
}
```

**Step 2: Start the frontend and visually verify**

```bash
cd stemApp && npm run dev
```

Open `http://localhost:3000/login`. You should see:
- The existing email/password form
- An "or" divider
- A "Continue with Google" button rendered by GIS
- A "Google Account Recovery" link at the bottom

**Step 3: Commit**

```bash
git add stemApp/app/components/LogIn.js
git commit -m "feat: add Google Sign In button and account recovery link to login page (STEMACT-405, STEMACT-407, STEMACT-408)"
```

---

## Task 7: Frontend — Update RegisterForm.js (STEMACT-406)

**Files:**
- Modify: `stemApp/app/components/RegisterForm.js`

**Step 1: Add Google flow detection at the top of the component**

At the top of `RegisterForm`, after the existing `searchParams` line (around line 27), add:

```javascript
const isGoogleFlow = searchParams.get('google') === '1';
const [googleCredential, setGoogleCredential] = useState(null);
const [googlePrefill, setGooglePrefill] = useState({ firstName: '', lastName: '', email: '' });
const [showEventDialog, setShowEventDialog] = useState(false);
```

**Step 2: Add a useEffect to load the stored Google credential**

After the existing `useEffect` for invite token validation, add:

```javascript
useEffect(() => {
    if (!isGoogleFlow) return;
    const cred = sessionStorage.getItem('google_credential');
    if (!cred) { navigate.push('/login'); return; }
    setGoogleCredential(cred);
    // Decode JWT payload (display only — backend re-verifies)
    try {
        const payload = JSON.parse(atob(cred.split('.')[1]));
        setGooglePrefill({
            firstName: payload.given_name || '',
            lastName: payload.family_name || '',
            email: payload.email || '',
        });
        setFormData(prev => ({
            ...prev,
            firstName: payload.given_name || '',
            lastName: payload.family_name || '',
            email: payload.email || '',
        }));
    } catch {
        navigate.push('/login');
    }
}, [isGoogleFlow]);
```

**Step 3: Update handleFormSubmit to branch on Google vs. password flow**

Replace the `handleFormSubmit` function with:

```javascript
const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (isGoogleFlow) {
        // Lighter validation — no password fields
        const googleSchema = z.object({
            phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits (no dashes or spaces)"),
            orgName: z.string().min(1, "Organization Name Required"),
        });
        const result = googleSchema.safeParse({ phone: formData.phone, orgName: formData.orgName });
        if (!result.success) { setErrors(result.error.format()); return; }

        try {
            const response = await fetch(apiUrl('/api/auth/google/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    credential: googleCredential,
                    phone: formData.phone,
                    orgName: formData.orgName,
                }),
            });
            const data = await response.json();
            if (data.success) {
                sessionStorage.removeItem('google_credential');
                setShowEventDialog(true);
            } else {
                setSubmitError(data.error || 'Registration failed');
            }
        } catch {
            setSubmitError('Something went wrong. Please try again.');
        }
        return;
    }

    // --- existing email/password flow below (unchanged) ---
    const userData = registerSchema.safeParse(formData);
    if (!userData.success) { setErrors(userData.error.format()); return; }

    try {
        const response = await fetch(apiUrl('/api/register'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                phone: formData.phone,
                password: formData.password,
                orgName: formData.orgName,
                ...(inviteToken ? { inviteToken } : {}),
                ...(formData.partnerCode.trim() ? { partnerCode: formData.partnerCode.trim() } : {}),
            }),
        });
        const data = await response.json();
        if (data.success) {
            setEmailSent(true);
        } else {
            setSubmitError(data.error || 'Registration failed');
        }
    } catch {
        setSubmitError('Something went wrong. Please try again.');
    }
};
```

**Step 4: Update the JSX to hide password fields and add post-registration dialog**

In the `return` block of `RegisterForm`:

1. Wrap the First Name and Last Name fields to be `readOnly` in Google flow:

Find the `firstName` TextField and add `inputProps={{ readOnly: isGoogleFlow }}` to it. Same for `lastName` and `email` TextFields.

2. Wrap the two password TextFields in a conditional:

```javascript
{!isGoogleFlow && (
    <>
        <TextField
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            fullWidth
            required
            error={Boolean(errors.password)}
            helperText={errors.password?._errors?.[0] || 'Min 8 chars, 1 uppercase, 1 lowercase, 1 number'}
        />
        <TextField
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            fullWidth
            required
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?._errors?.[0]}
        />
    </>
)}
```

3. Also hide the Partner Access Code field in Google flow (Google identity replaces it):

```javascript
{!isGoogleFlow && (
    <TextField
        label="Partner Access Code (optional)"
        {/* ... existing props ... */}
    />
)}
```

4. Add the post-Google-registration "Would you like to add an event?" dialog after the existing `emailSent` Dialog:

```javascript
<Dialog open={showEventDialog} maxWidth="sm" fullWidth>
    <DialogTitle>Registration Submitted</DialogTitle>
    <DialogContent>
        <Typography>
            Your organization has been submitted for admin approval.
            Would you like to add an event now?
        </Typography>
    </DialogContent>
    <DialogActions>
        <Button variant="outlined" onClick={() => navigate.push('/login')}>
            No, go to login
        </Button>
        <Button variant="contained" onClick={() => navigate.push('/submit')}>
            Yes, add an event
        </Button>
    </DialogActions>
</Dialog>
```

**Step 5: Visual verification**

1. Navigate to `http://localhost:3000/register` — confirm normal form is unchanged.
2. Put a valid GIS credential in `sessionStorage` (key: `google_credential`) via browser devtools, then navigate to `http://localhost:3000/register?google=1`.
3. Confirm: first name/last/email pre-filled and read-only, password fields hidden, phone and org name editable.

**Step 6: Commit**

```bash
git add stemApp/app/components/RegisterForm.js
git commit -m "feat: add Google OAuth registration flow to RegisterForm (STEMACT-406)"
```

---

## Task 8: Add "Continue with Google" to Register Page

The register page should also have the GIS button so partners who land there directly can use Google without going to login first.

**Files:**
- Modify: `stemApp/app/components/RegisterForm.js`

**Step 1: Import Script and add googleButtonRef**

At the top of `RegisterForm.js`, add to imports:

```javascript
import Script from 'next/script';
import { useRef } from 'react';
```

Add inside the component (near other refs/state):

```javascript
const googleButtonRef = useRef(null);
```

**Step 2: Add initGoogleSignIn and handleGoogleCredential**

Add these functions inside the component (before the return):

```javascript
const initGoogleSignIn = () => {
    if (!window.google || !googleButtonRef.current || isGoogleFlow) return;
    window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialOnRegister,
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleButtonRef.current.offsetWidth || 360,
        text: 'continue_with',
    });
};

const handleGoogleCredentialOnRegister = (response) => {
    sessionStorage.setItem('google_credential', response.credential);
    navigate.push('/register?google=1');
};
```

**Step 3: Add Script tag and Google button to JSX**

Wrap the return in a fragment and add the Script tag:

```javascript
return (
    <>
        <Script
            src="https://accounts.google.com/gsi/client"
            onLoad={initGoogleSignIn}
            strategy="afterInteractive"
        />
        <Box component="main" ...>
```

Inside the form Stack, after the Register button and before the closing Stack, add (only when not in Google flow):

```javascript
{!isGoogleFlow && (
    <>
        <Divider><Typography variant="caption" color="text.secondary">or</Typography></Divider>
        <Box ref={googleButtonRef} sx={{ display: 'flex', justifyContent: 'center' }} />
    </>
)}
```

Add `Divider` to the MUI imports at the top.

**Step 4: Commit**

```bash
git add stemApp/app/components/RegisterForm.js
git commit -m "feat: add Continue with Google button to registration page (STEMACT-405)"
```

---

## Task 9: End-to-End Smoke Test

**Goal:** Manually verify the full happy path with a real Google account.

**Prerequisites:**
- Backend running: `cd stemApp/backend && uvicorn api.main:app --reload --port 8000`
- Frontend running: `cd stemApp && npm run dev`
- `GOOGLE_CLIENT_ID` set in both `.env` files
- The domain `localhost` authorized in Google Cloud Console → OAuth consent screen → Authorized JavaScript origins: `http://localhost:3000`

**New user flow (STEMACT-406):**
1. Go to `http://localhost:3000/login`
2. Click "Continue with Google", select a Google account not yet in the DB
3. Confirm redirect to `/register?google=1`
4. Confirm first name, last name, email pre-filled and read-only
5. Enter a 10-digit phone and org name, click Register
6. Confirm "Would you like to add an event?" dialog appears
7. Click "No" — confirm redirect to `/login`

**Returning user flow (STEMACT-407):**
1. In DB, manually set the org status to `active` for the test org just created
2. Go to `http://localhost:3000/login`, click "Continue with Google" with the same account
3. Confirm redirect to `/partner` dashboard
4. Close the browser tab (sessionStorage cleared), reopen and go to `/partner`
5. Confirm redirect to `/login` (RouteGuard working)
6. Log in again with "Remember Me" checked
7. Close and reopen — confirm still logged in (localStorage persists)

**Account recovery link (STEMACT-408):**
1. On the login page, confirm "Google Account Recovery" link is visible
2. Click it — confirm it opens `https://accounts.google.com/signin/recovery` in a new tab

---

## Task 10: Final Commit & Branch Cleanup

```bash
git log --oneline -8
```

Confirm all feature commits are present, then open a PR from `feat/event-type-flyer` to `main` (or the appropriate base branch).
