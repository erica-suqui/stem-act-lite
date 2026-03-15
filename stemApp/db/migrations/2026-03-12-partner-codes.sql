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
