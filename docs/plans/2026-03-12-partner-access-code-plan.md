# Partner Access Code Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to generate single-use, time-limited codes that partners enter at signup or on their profile to get their organization automatically approved.

**Architecture:** New `partner_codes` table isolated from the existing `invitations` system. Three new backend endpoints (generate, validate, redeem) plus one list/revoke endpoint. Frontend changes in registration, a new partner profile page, and a new admin component.

**Tech Stack:** FastAPI + SQLAlchemy (backend), Next.js 15 + MUI v6 (frontend), PostgreSQL 16

---

### Task 1: Database — add `partner_codes` table

**Files:**
- Modify: `stemApp/db/schema.sql`
- Create: `stemApp/db/migrations/2026-03-12-partner-codes.sql`

**Step 1: Create the migration file**

```sql
-- stemApp/db/migrations/2026-03-12-partner-codes.sql
BEGIN;

CREATE TABLE IF NOT EXISTS partner_codes (
  code_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  created_by_user_id   BIGINT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  expires_at           TIMESTAMPTZ NOT NULL,
  consumed_at          TIMESTAMPTZ NULL,
  consumed_by_org_id   BIGINT NULL REFERENCES organizations(org_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_codes_code ON partner_codes(code);
CREATE INDEX IF NOT EXISTS idx_partner_codes_exp  ON partner_codes(expires_at);

COMMIT;
```

**Step 2: Apply the migration**

```bash
PGPASSWORD=stemact_pass psql -h 127.0.0.1 -p 5433 -U stemact_user -d stemact \
  -f stemApp/db/migrations/2026-03-12-partner-codes.sql
```

Expected output: `BEGIN`, `CREATE TABLE`, `CREATE INDEX`, `CREATE INDEX`, `COMMIT`

**Step 3: Add the table to schema.sql**

In `stemApp/db/schema.sql`, after the `invitations` table block (after line ~133), add:

```sql
-- =========================
-- PARTNER CODES
-- =========================

CREATE TABLE IF NOT EXISTS partner_codes (
  code_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  created_by_user_id   BIGINT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  expires_at           TIMESTAMPTZ NOT NULL,
  consumed_at          TIMESTAMPTZ NULL,
  consumed_by_org_id   BIGINT NULL REFERENCES organizations(org_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_codes_code ON partner_codes(code);
CREATE INDEX IF NOT EXISTS idx_partner_codes_exp  ON partner_codes(expires_at);
```

**Step 4: Verify the table exists**

```bash
PGPASSWORD=stemact_pass psql -h 127.0.0.1 -p 5433 -U stemact_user -d stemact \
  -c "\d partner_codes"
```

Expected: table description with all columns listed.

**Step 5: Commit**

```bash
git add stemApp/db/schema.sql stemApp/db/migrations/2026-03-12-partner-codes.sql
git commit -m "feat: add partner_codes table and migration"
```

---

### Task 2: Backend — code generation helper + Pydantic models

**Files:**
- Modify: `stemApp/backend/api/main.py` (after line 110, in the models section)

**Step 1: Add code generation helper and request models**

After the `RegisterRequest` class (around line 110 in `main.py`), add:

```python
import string  # add to top-level imports

def generate_partner_code() -> str:
    """Generate a short, hard-to-guess partner code like STEM-A3X9."""
    alphabet = string.ascii_uppercase + string.digits
    suffix = ''.join(secrets.choice(alphabet) for _ in range(4))
    return f"STEM-{suffix}"


class GeneratePartnerCodeRequest(BaseModel):
    expires_in_days: int = Field(default=7, ge=1, le=90)


class RedeemPartnerCodeRequest(BaseModel):
    code: str
    org_id: int
```

Note: `secrets` is already imported at line 3. Add `import string` to the imports block at the top of the file.

**Step 2: Verify the file parses without errors**

```bash
cd stemApp/backend && python3 -c "from api.main import app; print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add partner code helper and request models"
```

---

### Task 3: Backend — `POST /api/partner-codes/generate`

**Files:**
- Modify: `stemApp/backend/api/main.py` (append before the last endpoint or after line 545)

**Step 1: Add the generate endpoint**

Append to `main.py` (before the final line or at end of file):

```python
@app.post("/api/partner-codes/generate")
def generate_partner_code_endpoint(
    payload: GeneratePartnerCodeRequest,
    db: Session = Depends(get_db),
):
    expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)
    # Retry up to 5 times in case of collision (extremely unlikely)
    for _ in range(5):
        code = generate_partner_code()
        existing = db.execute(
            text("SELECT code_id FROM partner_codes WHERE code = :code"),
            {"code": code},
        ).first()
        if existing is None:
            break
    else:
        return JSONResponse({"success": False, "error": "Could not generate unique code"}, status_code=500)

    db.execute(
        text("""
            INSERT INTO partner_codes (code, expires_at)
            VALUES (:code, :expires_at)
        """),
        {"code": code, "expires_at": expires_at},
    )
    db.commit()
    return {"success": True, "code": code, "expires_at": expires_at.isoformat()}
```

**Step 2: Test the endpoint**

```bash
curl -s -X POST http://localhost:8000/api/partner-codes/generate \
  -H "Content-Type: application/json" \
  -d '{"expires_in_days": 7}' | python3 -m json.tool
```

Expected:
```json
{
  "success": true,
  "code": "STEM-XXXX",
  "expires_at": "2026-03-19T..."
}
```

**Step 3: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add POST /api/partner-codes/generate endpoint"
```

---

### Task 4: Backend — `GET /api/partner-codes/validate`

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add the validate endpoint**

```python
@app.get("/api/partner-codes/validate")
def validate_partner_code(code: str, db: Session = Depends(get_db)):
    row = db.execute(
        text("""
            SELECT code_id, expires_at, consumed_at
            FROM partner_codes
            WHERE code = :code
        """),
        {"code": code.upper().strip()},
    ).mappings().first()

    if row is None:
        return JSONResponse({"valid": False, "message": "Invalid code"}, status_code=404)
    if row["consumed_at"] is not None:
        return JSONResponse({"valid": False, "message": "This code has already been used"}, status_code=410)
    if row["expires_at"] < datetime.now(timezone.utc):
        return JSONResponse({"valid": False, "message": "This code has expired"}, status_code=410)

    return {"valid": True}
```

**Step 2: Test with the code you generated in Task 3**

```bash
# Replace STEM-XXXX with the code from Task 3
curl -s "http://localhost:8000/api/partner-codes/validate?code=STEM-XXXX" | python3 -m json.tool
```

Expected: `{"valid": true}`

```bash
curl -s "http://localhost:8000/api/partner-codes/validate?code=STEM-FAKE" | python3 -m json.tool
```

Expected: `{"valid": false, "message": "Invalid code"}`

**Step 3: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add GET /api/partner-codes/validate endpoint"
```

---

### Task 5: Backend — `GET /api/partner-codes` (list) + revoke

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add list and revoke endpoints**

```python
@app.get("/api/partner-codes")
def list_partner_codes(db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT
                pc.code_id,
                pc.code,
                pc.expires_at,
                pc.consumed_at,
                pc.created_at,
                o.org_name AS consumed_by_org
            FROM partner_codes pc
            LEFT JOIN organizations o ON o.org_id = pc.consumed_by_org_id
            ORDER BY pc.created_at DESC
        """)
    ).mappings().all()

    codes = []
    now = datetime.now(timezone.utc)
    for r in rows:
        if r["consumed_at"] is not None:
            status = "used"
        elif r["expires_at"] < now:
            status = "expired"
        else:
            status = "active"
        codes.append({
            "code_id": r["code_id"],
            "code": r["code"],
            "expires_at": r["expires_at"].isoformat(),
            "consumed_at": r["consumed_at"].isoformat() if r["consumed_at"] else None,
            "created_at": r["created_at"].isoformat(),
            "consumed_by_org": r["consumed_by_org"],
            "status": status,
        })
    return {"success": True, "codes": codes}


@app.post("/api/partner-codes/{code_id}/revoke")
def revoke_partner_code(code_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT code_id, consumed_at FROM partner_codes WHERE code_id = :id"),
        {"id": code_id},
    ).mappings().first()

    if row is None:
        return JSONResponse({"success": False, "message": "Code not found"}, status_code=404)
    if row["consumed_at"] is not None:
        return JSONResponse({"success": False, "message": "Code already consumed"}, status_code=400)

    db.execute(
        text("UPDATE partner_codes SET consumed_at = now() WHERE code_id = :id"),
        {"id": code_id},
    )
    db.commit()
    return {"success": True}
```

**Step 2: Test list endpoint**

```bash
curl -s "http://localhost:8000/api/partner-codes" | python3 -m json.tool
```

Expected: JSON with `"codes": [...]` containing the code from Task 3.

**Step 3: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add GET /api/partner-codes list and revoke endpoints"
```

---

### Task 6: Backend — modify `POST /api/register` to accept `partnerCode`

**Files:**
- Modify: `stemApp/backend/api/main.py` lines 102-110 (RegisterRequest) and 278-288 (register logic)

**Step 1: Add `partnerCode` to `RegisterRequest`**

Change `RegisterRequest` (around line 102) from:

```python
class RegisterRequest(BaseModel):
    firstName: str = Field(min_length=1)
    lastName: str = Field(min_length=1)
    orgName: str = Field(min_length=1)
    email: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    password: str = Field(min_length=8)
    inviteToken: str = None
```

To:

```python
class RegisterRequest(BaseModel):
    firstName: str = Field(min_length=1)
    lastName: str = Field(min_length=1)
    orgName: str = Field(min_length=1)
    email: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    password: str = Field(min_length=8)
    inviteToken: str = None
    partnerCode: str = None
```

**Step 2: Add partner code validation + org status logic to the register endpoint**

In the `register` function, find the block that sets org status (around line 254):

```python
"status": OrganizationStatus.pending.value,
```

Replace the entire `try` block logic to validate the partner code before insertion. After the duplicate email check and before the `try:`, add:

```python
    # Validate partner code if provided
    org_status = OrganizationStatus.pending.value
    partner_code_row = None
    if payload.partnerCode:
        code = payload.partnerCode.upper().strip()
        partner_code_row = db.execute(
            text("""
                SELECT code_id, expires_at, consumed_at
                FROM partner_codes WHERE code = :code
            """),
            {"code": code},
        ).mappings().first()
        if partner_code_row is None:
            return JSONResponse({"success": False, "error": "Invalid partner code"}, status_code=400)
        if partner_code_row["consumed_at"] is not None:
            return JSONResponse({"success": False, "error": "Partner code already used"}, status_code=400)
        if partner_code_row["expires_at"] < datetime.now(timezone.utc):
            return JSONResponse({"success": False, "error": "Partner code has expired"}, status_code=400)
        org_status = OrganizationStatus.active.value
```

Then change the org insert to use `org_status`:

```python
"status": org_status,
```

And after the existing `inviteToken` block (around line 278), add code to consume the partner code:

```python
        if payload.partnerCode and partner_code_row:
            db.execute(
                text("""
                    UPDATE partner_codes
                    SET consumed_at = now(), consumed_by_org_id = :org_id
                    WHERE code_id = :code_id
                """),
                {"org_id": org_id, "code_id": partner_code_row["code_id"]},
            )
```

**Step 3: Test registration with a partner code**

First generate a fresh code:
```bash
curl -s -X POST http://localhost:8000/api/partner-codes/generate \
  -H "Content-Type: application/json" \
  -d '{"expires_in_days": 1}' | python3 -m json.tool
```

Then register with it:
```bash
curl -s -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Partner",
    "orgName": "Test Org",
    "email": "testpartner@example.com",
    "phone": "8605551234",
    "password": "Test1234",
    "partnerCode": "STEM-XXXX"
  }' | python3 -m json.tool
```

Expected: `{"success": true, "user_id": ..., "org_id": ...}`

Verify org status is `active`:
```bash
PGPASSWORD=stemact_pass psql -h 127.0.0.1 -p 5433 -U stemact_user -d stemact \
  -c "SELECT org_name, status FROM organizations WHERE org_name = 'Test Org';"
```

Expected: `active`

Verify code was consumed:
```bash
curl -s "http://localhost:8000/api/partner-codes/validate?code=STEM-XXXX" | python3 -m json.tool
```

Expected: `{"valid": false, "message": "This code has already been used"}`

**Step 4: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: register endpoint accepts partnerCode for auto-approval"
```

---

### Task 7: Backend — `POST /api/partner-codes/redeem`

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add the redeem endpoint**

```python
@app.post("/api/partner-codes/redeem")
def redeem_partner_code(payload: RedeemPartnerCodeRequest, db: Session = Depends(get_db)):
    code = payload.code.upper().strip()

    row = db.execute(
        text("""
            SELECT code_id, expires_at, consumed_at
            FROM partner_codes WHERE code = :code
        """),
        {"code": code},
    ).mappings().first()

    if row is None:
        return JSONResponse({"success": False, "error": "Invalid code"}, status_code=404)
    if row["consumed_at"] is not None:
        return JSONResponse({"success": False, "error": "This code has already been used"}, status_code=410)
    if row["expires_at"] < datetime.now(timezone.utc):
        return JSONResponse({"success": False, "error": "This code has expired"}, status_code=410)

    org = db.execute(
        text("SELECT org_id, status FROM organizations WHERE org_id = :org_id"),
        {"org_id": payload.org_id},
    ).mappings().first()

    if org is None:
        return JSONResponse({"success": False, "error": "Organization not found"}, status_code=404)
    if org["status"] == OrganizationStatus.active.value:
        return JSONResponse({"success": False, "error": "Organization is already active"}, status_code=400)

    db.execute(
        text("UPDATE organizations SET status = :status WHERE org_id = :org_id"),
        {"status": OrganizationStatus.active.value, "org_id": payload.org_id},
    )
    db.execute(
        text("""
            UPDATE partner_codes
            SET consumed_at = now(), consumed_by_org_id = :org_id
            WHERE code_id = :code_id
        """),
        {"org_id": payload.org_id, "code_id": row["code_id"]},
    )
    db.commit()
    return {"success": True}
```

**Step 2: Test with an existing pending org**

First create a pending org (register without a code):
```bash
curl -s -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Pending",
    "lastName": "Partner",
    "orgName": "Pending Org",
    "email": "pending@example.com",
    "phone": "8605559999",
    "password": "Test1234"
  }' | python3 -m json.tool
```

Note the `org_id` from the response. Generate a new code, then redeem it:
```bash
curl -s -X POST http://localhost:8000/api/partner-codes/generate \
  -H "Content-Type: application/json" -d '{"expires_in_days": 1}' | python3 -m json.tool

curl -s -X POST http://localhost:8000/api/partner-codes/redeem \
  -H "Content-Type: application/json" \
  -d '{"code": "STEM-XXXX", "org_id": <org_id>}' | python3 -m json.tool
```

Expected: `{"success": true}`

**Step 3: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add POST /api/partner-codes/redeem endpoint"
```

---

### Task 8: Frontend — add optional partner code field to registration

**Files:**
- Modify: `stemApp/app/components/RegisterForm.js`

**Step 1: Add `partnerCode` to form state**

In `RegisterForm.js`, find the `useState` for `formData` (line 15) and add `partnerCode`:

```javascript
const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    orgName: '',
    phone: '',
    partnerCode: '',
});
```

**Step 2: Add code validation state**

After the `submitError` state (around line 38), add:

```javascript
const [codeStatus, setCodeStatus] = useState(null); // null | 'valid' | 'invalid'
const [codeMessage, setCodeMessage] = useState('');
```

**Step 3: Add `handleCodeBlur` for live validation**

After `handleChange`, add:

```javascript
const handleCodeBlur = async () => {
    const code = formData.partnerCode.trim();
    if (!code) { setCodeStatus(null); return; }
    try {
        const res = await fetch(apiUrl(`/api/partner-codes/validate?code=${encodeURIComponent(code)}`));
        const data = await res.json();
        if (data.valid) {
            setCodeStatus('valid');
            setCodeMessage('');
        } else {
            setCodeStatus('invalid');
            setCodeMessage(data.message || 'Invalid code');
        }
    } catch {
        setCodeStatus('invalid');
        setCodeMessage('Could not verify code');
    }
};
```

**Step 4: Pass `partnerCode` in the submit**

In `handleFormSubmit`, find the fetch body (around line 120):
```javascript
body: JSON.stringify({ ...formData, inviteToken: inviteToken || null })
```
Change to:
```javascript
body: JSON.stringify({
    ...formData,
    inviteToken: inviteToken || null,
    partnerCode: formData.partnerCode.trim() || null,
})
```

**Step 5: Add the UI field**

In the return JSX, after the `confirmPassword` TextField and before `{submitError && ...}`, add:

```jsx
<TextField
    label="Partner Access Code (optional)"
    name="partnerCode"
    value={formData.partnerCode}
    onChange={handleChange}
    onBlur={handleCodeBlur}
    fullWidth
    helperText={
        codeStatus === 'valid' ? '✓ Valid code — your account will be activated immediately' :
        codeStatus === 'invalid' ? codeMessage :
        'If you have an access code, enter it here'
    }
    error={codeStatus === 'invalid'}
    color={codeStatus === 'valid' ? 'success' : undefined}
    focused={codeStatus === 'valid' ? true : undefined}
    inputProps={{ style: { textTransform: 'uppercase' } }}
/>
```

**Step 6: Verify manually**

Start the Next.js dev server, go to `http://localhost:3000/register`, and:
- Enter a valid code → should show green helper text
- Enter an invalid code → should show red error
- Submit the form with the code → org should be created as `active`

**Step 7: Commit**

```bash
git add stemApp/app/components/RegisterForm.js
git commit -m "feat: add optional partner code field to registration form"
```

---

### Task 9: Frontend — partner profile page with code redemption

**Files:**
- Create: `stemApp/app/partner/profile/page.js`

**Step 1: Create the profile page**

```javascript
'use client';

import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Stack, Chip, CircularProgress,
} from '@mui/material';
import { apiUrl } from '@/lib/api';

export default function PartnerProfilePage() {
  const [orgStatus, setOrgStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [codeStatus, setCodeStatus] = useState(null); // null | 'valid' | 'invalid'
  const [codeMessage, setCodeMessage] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  useEffect(() => {
    if (!orgId) return;
    fetch(apiUrl(`/api/organizations/${orgId}`))
      .then(r => r.json())
      .then(data => {
        if (data.success) setOrgStatus(data.organization.status);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  const handleCodeBlur = async () => {
    const trimmed = code.trim();
    if (!trimmed) { setCodeStatus(null); return; }
    const res = await fetch(apiUrl(`/api/partner-codes/validate?code=${encodeURIComponent(trimmed)}`));
    const data = await res.json();
    if (data.valid) { setCodeStatus('valid'); setCodeMessage(''); }
    else { setCodeStatus('invalid'); setCodeMessage(data.message || 'Invalid code'); }
  };

  const handleRedeem = async () => {
    setRedeemError('');
    const res = await fetch(apiUrl('/api/partner-codes/redeem'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase(), org_id: Number(orgId) }),
    });
    const data = await res.json();
    if (data.success) {
      setRedeemSuccess(true);
      setOrgStatus('active');
    } else {
      setRedeemError(data.error || 'Failed to redeem code');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3, maxWidth: 520 }}>
      <Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
        Account Status
      </Typography>

      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body1">Organization status:</Typography>
            <Chip
              label={orgStatus === 'active' ? 'Active' : 'Pending Review'}
              color={orgStatus === 'active' ? 'success' : 'warning'}
            />
          </Stack>
        </CardContent>
      </Card>

      {orgStatus !== 'active' && !redeemSuccess && (
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Activate with Access Code</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter a partner access code to get your organization approved immediately.
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Access Code"
                value={code}
                onChange={e => { setCode(e.target.value); setCodeStatus(null); }}
                onBlur={handleCodeBlur}
                fullWidth
                inputProps={{ style: { textTransform: 'uppercase' } }}
                error={codeStatus === 'invalid'}
                color={codeStatus === 'valid' ? 'success' : undefined}
                helperText={
                  codeStatus === 'valid' ? '✓ Valid code' :
                  codeStatus === 'invalid' ? codeMessage : ''
                }
              />
              {redeemError && <Alert severity="error">{redeemError}</Alert>}
              <Button
                variant="contained"
                onClick={handleRedeem}
                disabled={codeStatus !== 'valid'}
              >
                Activate Account
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {redeemSuccess && (
        <Alert severity="success">Your organization has been activated!</Alert>
      )}
    </Box>
  );
}
```

**Step 2: Check that `GET /api/organizations/:id` exists**

```bash
curl -s "http://localhost:8000/api/organizations/1" | python3 -m json.tool
```

If it returns 404 or doesn't exist, add this endpoint to `main.py` first:

```python
@app.get("/api/organizations/{org_id}")
def get_organization(org_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT org_id, org_name, status FROM organizations WHERE org_id = :id"),
        {"id": org_id},
    ).mappings().first()
    if row is None:
        return JSONResponse({"success": False, "error": "Not found"}, status_code=404)
    return {"success": True, "organization": dict(row)}
```

**Step 3: Verify the page renders**

Navigate to `http://localhost:3000/partner/profile` while logged in as a pending partner. Should show the status chip and the code redemption form.

**Step 4: Commit**

```bash
git add stemApp/app/partner/profile/page.js stemApp/backend/api/main.py
git commit -m "feat: add partner profile page with access code redemption"
```

---

### Task 10: Frontend — admin Access Codes component

**Files:**
- Create: `stemApp/app/components/PartnerCodesAdmin.js`
- Modify: `stemApp/app/superAdminDashboard/page.js`

**Step 1: Create the admin component**

```javascript
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, MenuItem, Select, FormControl,
  InputLabel, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Typography, Alert,
} from '@mui/material';
import { apiUrl } from '@/lib/api';

const STATUS_COLOR = { active: 'success', used: 'default', expired: 'error', revoked: 'warning' };

export default function PartnerCodesAdmin() {
  const [codes, setCodes] = useState([]);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [newCode, setNewCode] = useState(null);
  const [generateError, setGenerateError] = useState('');

  const fetchCodes = useCallback(async () => {
    const res = await fetch(apiUrl('/api/partner-codes'));
    const data = await res.json();
    if (data.success) setCodes(data.codes);
  }, []);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const handleGenerate = async () => {
    setGenerateError('');
    setNewCode(null);
    const res = await fetch(apiUrl('/api/partner-codes/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expires_in_days: expiresInDays }),
    });
    const data = await res.json();
    if (data.success) { setNewCode(data.code); fetchCodes(); }
    else setGenerateError(data.error || 'Failed to generate code');
  };

  const handleRevoke = async (codeId) => {
    const res = await fetch(apiUrl(`/api/partner-codes/${codeId}/revoke`), { method: 'POST' });
    const data = await res.json();
    if (data.success) fetchCodes();
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>Partner Access Codes</Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Expires in</InputLabel>
          <Select value={expiresInDays} label="Expires in" onChange={e => setExpiresInDays(e.target.value)}>
            <MenuItem value={1}>1 day</MenuItem>
            <MenuItem value={7}>7 days</MenuItem>
            <MenuItem value={30}>30 days</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" onClick={handleGenerate}>Generate Code</Button>
      </Stack>

      {newCode && (
        <Alert severity="success" sx={{ mb: 2 }}>
          New code: <strong>{newCode}</strong> — share this with the partner.
        </Alert>
      )}
      {generateError && <Alert severity="error" sx={{ mb: 2 }}>{generateError}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Used by</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {codes.length === 0 && (
              <TableRow><TableCell colSpan={5}>No codes yet.</TableCell></TableRow>
            )}
            {codes.map(c => (
              <TableRow key={c.code_id}>
                <TableCell><strong>{c.code}</strong></TableCell>
                <TableCell>
                  <Chip label={c.status} color={STATUS_COLOR[c.status] || 'default'} size="small" />
                </TableCell>
                <TableCell>{new Date(c.expires_at).toLocaleDateString()}</TableCell>
                <TableCell>{c.consumed_by_org || '—'}</TableCell>
                <TableCell>
                  {c.status === 'active' && (
                    <Button size="small" color="error" onClick={() => handleRevoke(c.code_id)}>
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
```

**Step 2: Add to the super admin dashboard**

In `stemApp/app/superAdminDashboard/page.js`, import the component and add it below the existing `EventsTable`:

```javascript
import PartnerCodesAdmin from '../components/PartnerCodesAdmin';
```

And in the return JSX, after the `EventsTable` block:

```jsx
<Box sx={{ mt: 4 }}>
    <PartnerCodesAdmin />
</Box>
```

Note: `PartnerCodesAdmin` is a client component but the dashboard page is a server component. Wrap the import with `'use client'` directive or create a client wrapper. Since `page.js` is a server component, add `PartnerCodesAdmin` inside a `<Suspense>` boundary or convert the relevant section to a client component. The simplest approach: since `EventsTable` is already client-rendered, just add `PartnerCodesAdmin` alongside it — Next.js handles the client/server boundary automatically.

**Step 3: Verify in browser**

Navigate to `http://localhost:3000/superAdminDashboard`. The Access Codes section should appear below the events table with Generate / Revoke buttons and the codes list.

**Step 4: Commit**

```bash
git add stemApp/app/components/PartnerCodesAdmin.js stemApp/app/superAdminDashboard/page.js
git commit -m "feat: add PartnerCodesAdmin component to super admin dashboard"
```

---

## Summary of Files Changed

| File | Type |
|------|------|
| `stemApp/db/schema.sql` | Modified |
| `stemApp/db/migrations/2026-03-12-partner-codes.sql` | Created |
| `stemApp/backend/api/main.py` | Modified (~150 lines added) |
| `stemApp/app/components/RegisterForm.js` | Modified |
| `stemApp/app/partner/profile/page.js` | Created |
| `stemApp/app/components/PartnerCodesAdmin.js` | Created |
| `stemApp/app/superAdminDashboard/page.js` | Modified |
