# Org-Linked Partner Codes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to create organizations up-front and generate partner codes tied to a specific org, so the first partner to redeem the code is automatically linked to that org.

**Architecture:** Add `org_id` FK to `partner_codes`; new `POST/GET /api/organizations` endpoints; update generate, validate, and register endpoints; update `PartnerCodesAdmin` with org dropdown + org creation form; update `RegisterForm` to lock org name when code carries an org.

**Tech Stack:** FastAPI + SQLAlchemy (backend), Next.js 15 + MUI v6 (frontend), PostgreSQL 16

---

### Task 1: Database — add `org_id` to `partner_codes`

**Files:**
- Create: `stemApp/db/migrations/2026-03-12-partner-codes-org-link.sql`
- Modify: `stemApp/db/schema.sql`

**Step 1: Create the migration file**

```sql
-- stemApp/db/migrations/2026-03-12-partner-codes-org-link.sql
BEGIN;

ALTER TABLE partner_codes
  ADD COLUMN IF NOT EXISTS org_id BIGINT NULL
    REFERENCES organizations(org_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_partner_codes_org ON partner_codes(org_id);

COMMIT;
```

**Step 2: Apply the migration**

```bash
PGPASSWORD=stemact_pass psql -h 127.0.0.1 -p 5433 -U stemact_user -d stemact \
  -f stemApp/db/migrations/2026-03-12-partner-codes-org-link.sql
```

Expected: `BEGIN`, `ALTER TABLE`, `CREATE INDEX`, `COMMIT`

**Step 3: Add the column to schema.sql**

In `stemApp/db/schema.sql`, find the `partner_codes` CREATE TABLE block and add the column:

```sql
CREATE TABLE IF NOT EXISTS partner_codes (
  code_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  created_by_user_id   BIGINT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  org_id               BIGINT NULL REFERENCES organizations(org_id) ON DELETE SET NULL,
  expires_at           TIMESTAMPTZ NOT NULL,
  consumed_at          TIMESTAMPTZ NULL,
  consumed_by_org_id   BIGINT NULL REFERENCES organizations(org_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_codes_code ON partner_codes(code);
CREATE INDEX IF NOT EXISTS idx_partner_codes_exp  ON partner_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_partner_codes_org  ON partner_codes(org_id);
```

**Step 4: Verify**

```bash
PGPASSWORD=stemact_pass psql -h 127.0.0.1 -p 5433 -U stemact_user -d stemact \
  -c "\d partner_codes"
```

Expected: table shows `org_id` column with FK to organizations.

**Step 5: Commit**

```bash
git add stemApp/db/schema.sql stemApp/db/migrations/2026-03-12-partner-codes-org-link.sql
git commit -m "feat: add org_id FK to partner_codes table"
```

---

### Task 2: Backend — `POST /api/organizations` and `GET /api/organizations`

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add request model after `RedeemPartnerCodeRequest`**

Find `class RedeemPartnerCodeRequest` (around line 130) and add after it:

```python
class CreateOrganizationRequest(BaseModel):
    org_name: str = Field(min_length=1)
```

**Step 2: Add the two endpoints**

Append to the end of `main.py` (after the last endpoint):

```python
@app.post("/api/organizations")
def create_organization(payload: CreateOrganizationRequest, db: Session = Depends(get_db)):
    existing = db.execute(
        text("SELECT org_id FROM organizations WHERE lower(org_name) = lower(:name) LIMIT 1"),
        {"name": payload.org_name.strip()},
    ).first()
    if existing is not None:
        return JSONResponse({"success": False, "error": "An organization with this name already exists"}, status_code=409)

    result = db.execute(
        text("""
            INSERT INTO organizations (org_name, contact_email, contact_phone, status)
            VALUES (:org_name, '', '', :status)
            RETURNING org_id
        """),
        {"org_name": payload.org_name.strip(), "status": OrganizationStatus.active.value},
    )
    org_id = result.scalar()
    db.commit()
    return {"success": True, "org_id": org_id, "org_name": payload.org_name.strip()}


@app.get("/api/organizations")
def list_organizations(db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT org_id, org_name, status FROM organizations ORDER BY org_name")
    ).mappings().all()
    return {"success": True, "organizations": [dict(r) for r in rows]}
```

**Step 3: Verify the file parses**

```bash
cd stemApp/backend && .venv/bin/python3 -c "from api.main import app; print('OK')"
```

Expected: `OK`

**Step 4: Test create org**

```bash
curl -s -X POST http://localhost:8000/api/organizations \
  -H "Content-Type: application/json" \
  -d '{"org_name": "Test Corp"}' | python3 -m json.tool
```

Expected: `{"success": true, "org_id": <N>, "org_name": "Test Corp"}`

**Step 5: Test list orgs**

```bash
curl -s "http://localhost:8000/api/organizations" | python3 -m json.tool
```

Expected: JSON with `"organizations": [...]` containing Test Corp.

**Step 6: Test duplicate name**

```bash
curl -s -X POST http://localhost:8000/api/organizations \
  -H "Content-Type: application/json" \
  -d '{"org_name": "Test Corp"}' | python3 -m json.tool
```

Expected: `{"success": false, "error": "An organization with this name already exists"}`

**Step 7: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add POST /api/organizations and GET /api/organizations endpoints"
```

---

### Task 3: Backend — update `generate` endpoint to accept `org_id`

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add `org_id` to `GeneratePartnerCodeRequest`**

Find `class GeneratePartnerCodeRequest` and change it to:

```python
class GeneratePartnerCodeRequest(BaseModel):
    expires_in_days: int = Field(default=7, ge=1, le=90)
    org_id: int = None
```

**Step 2: Update the generate endpoint to store `org_id`**

Find the `generate_partner_code_endpoint` function. Change the INSERT to include `org_id`:

```python
    db.execute(
        text("""
            INSERT INTO partner_codes (code, expires_at, org_id)
            VALUES (:code, :expires_at, :org_id)
        """),
        {"code": code, "expires_at": expires_at, "org_id": payload.org_id},
    )
```

And update the return to include it:

```python
    return {"success": True, "code": code, "expires_at": expires_at.isoformat(), "org_id": payload.org_id}
```

**Step 3: Test generate without org_id (backward compat)**

```bash
curl -s -X POST http://localhost:8000/api/partner-codes/generate \
  -H "Content-Type: application/json" \
  -d '{"expires_in_days": 7}' | python3 -m json.tool
```

Expected: `{"success": true, "code": "STEM-XXXX", ..., "org_id": null}`

**Step 4: Test generate with org_id**

Use the `org_id` from Task 2:
```bash
curl -s -X POST http://localhost:8000/api/partner-codes/generate \
  -H "Content-Type: application/json" \
  -d '{"expires_in_days": 7, "org_id": <N>}' | python3 -m json.tool
```

Expected: `{"success": true, "code": "STEM-XXXX", ..., "org_id": <N>}`

**Step 5: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: generate endpoint accepts org_id to pre-link partner codes"
```

---

### Task 4: Backend — update `validate` endpoint to return `org_name`

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Update the validate endpoint query and response**

Find `validate_partner_code` and replace it with:

```python
@app.get("/api/partner-codes/validate")
def validate_partner_code(code: str, db: Session = Depends(get_db)):
    row = db.execute(
        text("""
            SELECT pc.code_id, pc.expires_at, pc.consumed_at,
                   pc.org_id, o.org_name
            FROM partner_codes pc
            LEFT JOIN organizations o ON o.org_id = pc.org_id
            WHERE pc.code = :code
        """),
        {"code": code.upper().strip()},
    ).mappings().first()

    if row is None:
        return JSONResponse({"valid": False, "message": "Invalid code"}, status_code=404)
    if row["consumed_at"] is not None:
        return JSONResponse({"valid": False, "message": "This code has already been used"}, status_code=410)
    if row["expires_at"] < datetime.now(timezone.utc):
        return JSONResponse({"valid": False, "message": "This code has expired"}, status_code=410)

    return {
        "valid": True,
        "org_id": row["org_id"],
        "org_name": row["org_name"],
    }
```

**Step 2: Test validate on a code without org**

```bash
curl -s "http://localhost:8000/api/partner-codes/validate?code=STEM-XXXX" | python3 -m json.tool
```

Expected: `{"valid": true, "org_id": null, "org_name": null}`

**Step 3: Test validate on the org-linked code from Task 3**

```bash
curl -s "http://localhost:8000/api/partner-codes/validate?code=STEM-YYYY" | python3 -m json.tool
```

Expected: `{"valid": true, "org_id": <N>, "org_name": "Test Corp"}`

**Step 4: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: validate endpoint returns org_id and org_name"
```

---

### Task 5: Backend — update `register` endpoint to handle org-linked codes

**Files:**
- Modify: `stemApp/backend/api/main.py` (the `register` function)

**Step 1: Update the partner code validation block to also fetch `org_id`**

Find the block starting with `if payload.partnerCode:` (around line 240). Change the SELECT query to include `org_id`:

```python
        partner_code_row = db.execute(
            text("""
                SELECT code_id, expires_at, consumed_at, org_id
                FROM partner_codes WHERE code = :code
            """),
            {"code": code},
        ).mappings().first()
```

**Step 2: Modify the org creation logic**

Find the `try:` block in `register`. Replace the existing `org_result = db.execute(...)` block with this branching logic:

```python
        # If the partner code is linked to a pre-existing org, use it directly
        if partner_code_row and partner_code_row["org_id"]:
            org_id = partner_code_row["org_id"]
            # Update the org's contact info with this partner's details
            db.execute(
                text("""
                    UPDATE organizations
                    SET contact_first_name = :first_name,
                        contact_last_name  = :last_name,
                        contact_email      = :email,
                        contact_phone      = :phone
                    WHERE org_id = :org_id
                      AND contact_email = ''
                """),
                {
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "phone": phone,
                    "org_id": org_id,
                },
            )
        else:
            org_result = db.execute(
                text(
                    """
                    INSERT INTO organizations (
                        org_name,
                        contact_first_name,
                        contact_last_name,
                        contact_email,
                        contact_phone,
                        status
                    )
                    VALUES (
                        :org_name,
                        :contact_first_name,
                        :contact_last_name,
                        :contact_email,
                        :contact_phone,
                        :status
                    )
                    RETURNING org_id
                    """
                ),
                {
                    "org_name": org_name,
                    "contact_first_name": first_name,
                    "contact_last_name": last_name,
                    "contact_email": email,
                    "contact_phone": phone,
                    "status": org_status,
                },
            )
            org_row = org_result.mappings().first()
            org_id = org_row["org_id"]
```

**Step 3: Test registration with org-linked code**

Generate a fresh org-linked code:
```bash
ORG_CODE=$(curl -s -X POST http://localhost:8000/api/partner-codes/generate \
  -H "Content-Type: application/json" \
  -d '{"expires_in_days": 1, "org_id": <N>}' | python3 -c "import sys,json; print(json.load(sys.stdin)['code'])")
echo "Code: $ORG_CODE"
```

Register with it:
```bash
curl -s -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -d "{
    \"firstName\": \"Jane\",
    \"lastName\": \"Smith\",
    \"orgName\": \"anything\",
    \"email\": \"jane@example.com\",
    \"phone\": \"8605550001\",
    \"password\": \"Test1234\",
    \"partnerCode\": \"$ORG_CODE\"
  }" | python3 -m json.tool
```

Expected: `{"success": true, "user_id": ..., "org_id": <N>}` — same org_id as the pre-created org.

Verify no new org was created and contact info was updated:
```bash
PGPASSWORD=stemact_pass psql -h 127.0.0.1 -p 5433 -U stemact_user -d stemact \
  -c "SELECT org_id, org_name, contact_first_name, contact_email FROM organizations WHERE org_id = <N>;"
```

Expected: shows "Jane" and "jane@example.com".

**Step 4: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: register uses pre-existing org when code has org_id"
```

---

### Task 6: Frontend — update `PartnerCodesAdmin` with org management

**Files:**
- Modify: `stemApp/app/components/PartnerCodesAdmin.js`

**Step 1: Add org state and fetch**

After the existing state declarations, add:

```javascript
const [orgs, setOrgs] = useState([]);
const [selectedOrgId, setSelectedOrgId] = useState('');
const [newOrgName, setNewOrgName] = useState('');
const [createOrgError, setCreateOrgError] = useState('');
const [creatingOrg, setCreatingOrg] = useState(false);
```

Add a `fetchOrgs` function alongside `fetchCodes`:

```javascript
const fetchOrgs = useCallback(async () => {
  const res = await fetch(apiUrl('/api/organizations'));
  const data = await res.json();
  if (data.success) setOrgs(data.organizations);
}, []);
```

Update the `useEffect` to also fetch orgs:

```javascript
useEffect(() => { fetchCodes(); fetchOrgs(); }, [fetchCodes, fetchOrgs]);
```

**Step 2: Add `handleCreateOrg` function**

```javascript
const handleCreateOrg = async () => {
  setCreateOrgError('');
  setCreatingOrg(true);
  const res = await fetch(apiUrl('/api/organizations'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_name: newOrgName.trim() }),
  });
  const data = await res.json();
  setCreatingOrg(false);
  if (data.success) {
    setNewOrgName('');
    fetchOrgs();
  } else {
    setCreateOrgError(data.error || 'Failed to create organization');
  }
};
```

**Step 3: Update `handleGenerate` to include `org_id`**

```javascript
body: JSON.stringify({ expires_in_days: expiresInDays, org_id: selectedOrgId || null }),
```

**Step 4: Add "For Org" column to the code table**

In `TableHead`, add after "Expires":
```jsx
<TableCell>For Org</TableCell>
```

In `TableBody` rows, add after the expires cell:
```jsx
<TableCell>{c.org_name || '—'}</TableCell>
```

Note: the list endpoint needs to return `org_name` — that's handled in Task 7.

**Step 5: Replace the generate UI section**

Replace the existing generate Stack with:

```jsx
{/* Create org */}
<Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
  <Typography variant="subtitle2" fontWeight={600} gutterBottom>Create Organization</Typography>
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
    <TextField
      size="small"
      label="Organization Name"
      value={newOrgName}
      onChange={e => setNewOrgName(e.target.value)}
      sx={{ flex: 1 }}
    />
    <Button variant="outlined" onClick={handleCreateOrg} disabled={!newOrgName.trim() || creatingOrg}>
      {creatingOrg ? 'Creating…' : 'Create Org'}
    </Button>
  </Stack>
  {createOrgError && <Alert severity="error" sx={{ mt: 1 }}>{createOrgError}</Alert>}
</Paper>

{/* Generate code */}
<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mb: 3 }}>
  <FormControl size="small" sx={{ minWidth: 160 }}>
    <InputLabel>Expires in</InputLabel>
    <Select value={expiresInDays} label="Expires in" onChange={e => setExpiresInDays(e.target.value)}>
      <MenuItem value={1}>1 day</MenuItem>
      <MenuItem value={7}>7 days</MenuItem>
      <MenuItem value={30}>30 days</MenuItem>
    </Select>
  </FormControl>
  <FormControl size="small" sx={{ minWidth: 200 }}>
    <InputLabel>Link to org (optional)</InputLabel>
    <Select
      value={selectedOrgId}
      label="Link to org (optional)"
      onChange={e => setSelectedOrgId(e.target.value)}
    >
      <MenuItem value=''>— No org (general use) —</MenuItem>
      {orgs.map(o => (
        <MenuItem key={o.org_id} value={o.org_id}>{o.org_name}</MenuItem>
      ))}
    </Select>
  </FormControl>
  <Button variant="contained" onClick={handleGenerate}>Generate Code</Button>
</Stack>
```

**Step 6: Update imports to add `Paper` and `TextField`**

Add `Paper` and `TextField` to the MUI import if not already present:

```javascript
import {
  Box, Button, Chip, MenuItem, Select, FormControl,
  InputLabel, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Typography, Alert, TextField,
} from '@mui/material';
```

**Step 7: Verify the component builds**

```bash
cd /home/j/Documents/stem-act/stemApp && npm run build 2>&1 | tail -5
```

Expected: build succeeds with no errors.

**Step 8: Commit**

```bash
git add stemApp/app/components/PartnerCodesAdmin.js
git commit -m "feat: PartnerCodesAdmin adds org creation and org-linked code generation"
```

---

### Task 7: Backend — update list endpoint to return `org_name` per code

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Update `list_partner_codes` query to join on `org_id`**

Find `list_partner_codes` and update its SELECT:

```python
    rows = db.execute(
        text("""
            SELECT
                pc.code_id,
                pc.code,
                pc.expires_at,
                pc.consumed_at,
                pc.created_at,
                pc.org_id,
                linked_org.org_name AS org_name,
                consumed_org.org_name AS consumed_by_org
            FROM partner_codes pc
            LEFT JOIN organizations linked_org   ON linked_org.org_id   = pc.org_id
            LEFT JOIN organizations consumed_org ON consumed_org.org_id = pc.consumed_by_org_id
            ORDER BY pc.created_at DESC
        """)
    ).mappings().all()
```

And add `org_name` to the dict being built in the loop:

```python
        codes.append({
            "code_id": r["code_id"],
            "code": r["code"],
            "expires_at": r["expires_at"].isoformat(),
            "consumed_at": r["consumed_at"].isoformat() if r["consumed_at"] else None,
            "created_at": r["created_at"].isoformat(),
            "org_id": r["org_id"],
            "org_name": r["org_name"],
            "consumed_by_org": r["consumed_by_org"],
            "status": status,
        })
```

**Step 2: Test**

```bash
curl -s "http://localhost:8000/api/partner-codes" | python3 -m json.tool
```

Expected: codes list includes `"org_name"` field (org-linked codes show org name, others show `null`).

**Step 3: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: partner codes list returns org_name for org-linked codes"
```

---

### Task 8: Frontend — update `RegisterForm` to lock org name when code has org

**Files:**
- Modify: `stemApp/app/components/RegisterForm.js`

**Step 1: Add `codeOrgName` state**

After the `codeMessage` state declaration:

```javascript
const [codeOrgName, setCodeOrgName] = useState(null); // org name from code, if any
```

**Step 2: Update `handleCodeBlur` to capture `org_name`**

In `handleCodeBlur`, update the success branch:

```javascript
        if (data.valid) {
            setCodeStatus('valid');
            setCodeMessage('');
            setCodeOrgName(data.org_name || null);
            if (data.org_name) {
                setFormData(prev => ({ ...prev, orgName: data.org_name }));
            }
        } else {
            setCodeStatus('invalid');
            setCodeMessage(data.message || 'Invalid code');
            setCodeOrgName(null);
        }
```

Also reset `codeOrgName` in the catch block:
```javascript
        setCodeOrgName(null);
```

**Step 3: Update the org name TextField to be read-only when locked**

Find the "Organization Name" TextField and update it:

```jsx
<TextField
    label="Organization Name"
    name="orgName"
    value={formData.orgName}
    onChange={handleChange}
    fullWidth
    required={!codeOrgName}
    error={Boolean(errors.orgName)}
    helperText={
        codeOrgName
            ? `Joining: ${codeOrgName} — your account will be activated immediately`
            : errors.orgName?._errors?.[0]
    }
    inputProps={{ readOnly: Boolean(codeOrgName) }}
    color={codeOrgName ? 'success' : undefined}
    focused={codeOrgName ? true : undefined}
/>
```

**Step 4: Update the partner code helper text**

In the "Partner Access Code" TextField, update `helperText`:

```jsx
helperText={
    codeStatus === 'valid'
        ? codeOrgName
            ? `✓ Valid code — you will join ${codeOrgName}`
            : '✓ Valid code — your account will be activated immediately'
        : codeStatus === 'invalid' ? codeMessage
        : 'If you have an access code, enter it here'
}
```

**Step 5: Reset `codeOrgName` when partner code field is cleared**

In `handleChange`, add a reset when the partnerCode field is cleared:

```javascript
    const handleChange = (e) => {
        const {name, value} = e.target;
        setFormData(prev => ({...prev, [name]: value}));
        if (name === 'partnerCode' && !value.trim()) {
            setCodeStatus(null);
            setCodeOrgName(null);
            setFormData(prev => ({ ...prev, partnerCode: value, orgName: '' }));
        }
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };
```

**Step 6: Verify build**

```bash
cd /home/j/Documents/stem-act/stemApp && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

**Step 7: Manual verification**

1. Go to `http://localhost:3000/register`
2. Enter an org-linked code → org name field should pre-fill with the org name and become read-only with green styling
3. Enter a non-org code → org name field stays editable
4. Clear the code → org name field resets

**Step 8: Commit**

```bash
git add stemApp/app/components/RegisterForm.js
git commit -m "feat: register form locks org name when code is linked to a pre-existing org"
```

---

## Summary of Files Changed

| File | Type |
|------|------|
| `stemApp/db/schema.sql` | Modified |
| `stemApp/db/migrations/2026-03-12-partner-codes-org-link.sql` | Created |
| `stemApp/backend/api/main.py` | Modified (~80 lines) |
| `stemApp/app/components/PartnerCodesAdmin.js` | Modified |
| `stemApp/app/components/RegisterForm.js` | Modified |
