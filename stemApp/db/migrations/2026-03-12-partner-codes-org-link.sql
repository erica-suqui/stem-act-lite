-- stemApp/db/migrations/2026-03-12-partner-codes-org-link.sql
BEGIN;

ALTER TABLE partner_codes
  ADD COLUMN IF NOT EXISTS org_id BIGINT NULL
    REFERENCES organizations(org_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_partner_codes_org ON partner_codes(org_id);

COMMIT;
