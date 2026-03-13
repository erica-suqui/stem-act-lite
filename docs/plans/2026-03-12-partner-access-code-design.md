# Partner Access Code — Design

## Overview

Partners can enter a single-use, time-limited code at signup or on their profile to get their organization automatically approved, bypassing the manual admin review process.

## Data Model

New `partner_codes` table added to `schema.sql` and a migration file:

```sql
CREATE TABLE partner_codes (
  code_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  created_by_user_id   BIGINT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  expires_at           TIMESTAMPTZ NOT NULL,
  consumed_at          TIMESTAMPTZ NULL,
  consumed_by_org_id   BIGINT NULL REFERENCES organizations(org_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_codes_code ON partner_codes(code);
CREATE INDEX idx_partner_codes_exp  ON partner_codes(expires_at);
```

Codes are short alphanumeric strings in the format `STEM-XXXX` (e.g. `STEM-A3X9`), generated with `secrets` to be hard to guess but easy to type.

## API Endpoints

All endpoints live in `stemApp/backend/api/main.py`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/partner-codes/generate` | Admin/Super Admin | Create a new code with a chosen expiry |
| `GET`  | `/api/partner-codes/validate?code=STEM-A3X9` | Public | Check if a code is valid (not consumed, not expired) |
| `POST` | `/api/partner-codes/redeem` | Logged-in partner | Redeem a code to activate an existing pending org |
| `GET`  | `/api/partner-codes` | Admin/Super Admin | List all codes with status |
| `POST` | `/api/partner-codes/{code_id}/revoke` | Admin/Super Admin | Revoke a code before it's used |

**Registration flow change:** `POST /api/register` accepts an optional `partnerCode` field. If provided and valid, the organization is created with `status = 'active'` instead of `'pending'`, and the code is marked consumed.

**Error responses:**
- Code not found → 404
- Code already consumed → 410
- Code expired → 410
- Org already active → 400

## Frontend

### 1. Registration form (`RegisterForm.js`)
- Optional "Partner Access Code" field at bottom of form
- Validated on blur via `GET /api/partner-codes/validate`
- Shows green checkmark if valid, inline error if not
- Sent as `partnerCode` on form submit

### 2. Partner profile page (`app/partner/profile/page.js`) — new
- Accessible from the partner dashboard nav
- If org status is `pending`: shows a "Enter Access Code" field with a Redeem button
- On success: shows confirmation and updates displayed status to Active
- If org already active: shows current status, no code field

### 3. Admin dashboard — new Access Codes section
- Lives in the super admin dashboard (new tab or section)
- Generate code UI: choose expiry (1 day / 7 days / 30 days), click Generate, copy the code
- Codes table: code, created date, expiry, status (Active / Used / Expired / Revoked), used by org
- Revoke button on active codes

## Code Format

Codes are generated as `STEM-` prefix + 4 uppercase alphanumeric characters (e.g. `STEM-A3X9`). This gives 36^4 = ~1.7M combinations — sufficient for a self-service code system where codes are single-use and short-lived.

```python
import secrets, string
def generate_partner_code():
    alphabet = string.ascii_uppercase + string.digits
    suffix = ''.join(secrets.choice(alphabet) for _ in range(4))
    return f"STEM-{suffix}"
```

## Files to Change

| File | Change |
|------|--------|
| `stemApp/db/schema.sql` | Add `partner_codes` table |
| `stemApp/db/migrations/YYYY-MM-DD-partner-codes.sql` | Migration for existing DBs |
| `stemApp/backend/api/main.py` | 4 new endpoints + register change |
| `stemApp/app/components/RegisterForm.js` | Add optional code field |
| `stemApp/app/partner/profile/page.js` | New partner profile page |
| `stemApp/app/superAdminDashboard/page.js` | Add Access Codes section |
| `stemApp/app/components/PartnerCodesAdmin.js` | New admin component for code management |
