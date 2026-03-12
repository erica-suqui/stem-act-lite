BEGIN;

-- Organizations: split contact name into first/last name fields.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS contact_first_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS contact_last_name TEXT NULL;

ALTER TABLE organizations
  DROP COLUMN IF EXISTS contact_name;

-- Org applications: split contact name into required first/last name fields.
ALTER TABLE org_applications
  ADD COLUMN IF NOT EXISTS contact_first_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_last_name TEXT;

UPDATE org_applications
SET
  contact_first_name = COALESCE(contact_first_name, ''),
  contact_last_name = COALESCE(contact_last_name, '')
WHERE contact_first_name IS NULL OR contact_last_name IS NULL;

ALTER TABLE org_applications
  ALTER COLUMN contact_first_name SET NOT NULL,
  ALTER COLUMN contact_last_name SET NOT NULL;

ALTER TABLE org_applications
  DROP COLUMN IF EXISTS contact_name;

-- Admin-managed tags for consistent event categorization.
CREATE TABLE IF NOT EXISTS tags (
  tag_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_tags (
  event_id    BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  tag_id      BIGINT NOT NULL REFERENCES tags(tag_id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_active ON tags(is_active);
CREATE INDEX IF NOT EXISTS idx_event_tags_tag_id ON event_tags(tag_id);

COMMIT;
