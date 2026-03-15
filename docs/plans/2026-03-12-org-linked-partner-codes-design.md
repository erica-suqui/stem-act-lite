# Org-Linked Partner Codes — Design

**Date:** 2026-03-12
**Status:** Approved

## Goal

Allow admins to create organizations up-front (before any partner exists), then generate a partner code tied to that org. When a partner redeems the code at registration, they are automatically linked to the pre-existing org instead of creating a new one. The first partner to redeem becomes the org's primary contact.

## User Flow

1. Admin visits `/users` → clicks "Create Organization" → enters org name → org is created with status `active`
2. Admin generates a partner code, optionally selecting an org from a dropdown
3. Admin shares the code (`STEM-XXXX`) with the partner
4. Partner goes to `/register`, enters the code
5. Validate endpoint returns `org_name` → form pre-fills and locks the org name field ("Joining: ACME Corp")
6. Partner submits form → no new org is created; user is linked to the existing org, contact fields updated from form data
7. Code is marked consumed

Codes without an org still work as before (partner names their own org, new org created).

## Database

```sql
ALTER TABLE partner_codes
  ADD COLUMN org_id BIGINT NULL REFERENCES organizations(org_id) ON DELETE SET NULL;
```

Admin-created orgs are inserted with `contact_first_name = ''`, `contact_last_name = ''`, `contact_email = ''`, `contact_phone = ''` (schema requires non-null). These are overwritten when the first partner registers.

## Backend

| Endpoint | Change |
|----------|--------|
| `POST /api/organizations` | **New** — admin creates org; body: `{ org_name }` |
| `GET /api/organizations` | **New** — list all orgs (for dropdown in PartnerCodesAdmin) |
| `POST /api/partner-codes/generate` | Add optional `org_id` field; stored on code row |
| `GET /api/partner-codes/validate` | Returns `org_id` + `org_name` when present |
| `POST /api/register` | If code has `org_id`: skip org INSERT, set `users.org_id` to existing org, update org contact columns from form data |

## Frontend

### `/users` page — Create Organization
- New "Create Organization" button above the PartnerCodesAdmin section (or inline in PartnerCodesAdmin)
- Form: org name only → POST `/api/organizations` → list refreshes

### `PartnerCodesAdmin` component
- "Generate Code" section gains an optional org dropdown (fetched from `GET /api/organizations`)
- If no org selected, behavior unchanged
- Code table shows org name in a new "For Org" column

### `RegisterForm` component
- When validate returns `org_name`, org name field is pre-filled and set `readOnly`
- Helper text: "Joining: [Org Name] — your account will be activated immediately"
- Zod validation skips org name required check when org is locked by code

## Edge Cases

- Code with org → org already has a member → allowed (multiple users per org is valid)
- Code without org → existing behavior (new org created)
- Admin-created org with placeholder contact info → overwritten on first partner registration
- PartnerCodesAdmin only appears on `/users` page, not on super admin dashboard
