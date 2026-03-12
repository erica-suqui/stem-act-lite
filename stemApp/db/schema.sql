-- PostgreSQL schema 

BEGIN;

-- =========================
-- USERS / ORGS
-- =========================

CREATE TABLE IF NOT EXISTS organizations (
  org_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_name            TEXT NOT NULL,
  contact_first_name  TEXT NULL,
  contact_last_name   TEXT NULL,
  contact_email       TEXT NOT NULL,
  contact_phone       TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','active','disabled','approved','rejected','inactive'))
);

CREATE TABLE IF NOT EXISTS users (
  user_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id    BIGINT NULL REFERENCES organizations(org_id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email     TEXT NOT NULL UNIQUE,
  role      TEXT NOT NULL
           CHECK (role IN ('super_admin','admin','partner'))
);

-- =========================
-- ORG APPLICATIONS
-- =========================

CREATE TABLE IF NOT EXISTS org_applications (
  application_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_name            TEXT NOT NULL,
  contact_first_name  TEXT NOT NULL,
  contact_last_name   TEXT NOT NULL,
  contact_email       TEXT NOT NULL,
  contact_phone       TEXT NOT NULL,
  website             TEXT NULL,
  notes               TEXT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- EVENTS
-- =========================

CREATE TABLE IF NOT EXISTS events (
  event_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  org_id               BIGINT NULL REFERENCES organizations(org_id) ON DELETE SET NULL,
  submitted_by_user_id BIGINT NULL REFERENCES users(user_id) ON DELETE SET NULL,

  submitter_name       TEXT NULL,
  submitter_email      TEXT NULL,
  submitter_phone      TEXT NULL,

  title                TEXT NOT NULL,
  description          TEXT NOT NULL,

  start_datetime       TIMESTAMPTZ NOT NULL,
  end_datetime         TIMESTAMPTZ NULL,

  address              TEXT NOT NULL,
  city                 TEXT NOT NULL,
  county               TEXT NOT NULL,

  audience             TEXT NULL,
  cost                 TEXT NULL, 
  hyperlink            TEXT NULL,
  event_contact        TEXT NULL,
  admin_comment        TEXT NULL,
  reviewed_by_user_id  BIGINT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  reviewed_at          TIMESTAMPTZ NULL,

  status               TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','denied','rejected')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_event_end_after_start
    CHECK (end_datetime IS NULL OR end_datetime >= start_datetime)
);

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

-- =========================
-- EVENT REVISIONS
-- =========================

CREATE TABLE IF NOT EXISTS event_revisions (
  revision_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id             BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,

  submitted_by_user_id BIGINT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  submitter_name       TEXT NULL,
  submitter_email      TEXT NULL,
  submitter_phone      TEXT NULL,

  status               TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','denied','rejected')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- INVITATIONS
-- =========================

CREATE TABLE IF NOT EXISTS invitations (
  invitation_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token          TEXT NOT NULL UNIQUE,
  role           TEXT NOT NULL CHECK (role IN ('super_admin','admin','partner')),
  expires_at     TIMESTAMPTZ NOT NULL,
  consumed_at    TIMESTAMPTZ NULL,
  created_by_user_id BIGINT NULL REFERENCES users(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- NOTIFICATIONS
-- =========================

CREATE TABLE IF NOT EXISTS notifications (
  notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  event_id        BIGINT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  application_id  BIGINT NULL REFERENCES org_applications(application_id) ON DELETE CASCADE,

  recipient_email TEXT NOT NULL,
  type            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','sent','failed')),

  sent_at         TIMESTAMPTZ NULL,
  error_message   TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure a notification is tied to *something*
  CONSTRAINT chk_notification_target
    CHECK (
      (event_id IS NOT NULL AND application_id IS NULL)
      OR
      (event_id IS NULL AND application_id IS NOT NULL)
    )
);

-- =========================
-- Helpful indexes
-- =========================

CREATE INDEX IF NOT EXISTS idx_users_org_id        ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_events_org_id       ON events(org_id);
CREATE INDEX IF NOT EXISTS idx_events_status       ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_county       ON events(county);
CREATE INDEX IF NOT EXISTS idx_tags_slug           ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_active         ON tags(is_active);
CREATE INDEX IF NOT EXISTS idx_event_tags_tag_id   ON event_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_event_revisions_evt ON event_revisions(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_evt   ON notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_app   ON notifications(application_id);
CREATE INDEX IF NOT EXISTS idx_notifications_stat  ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_invitations_token   ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_exp     ON invitations(expires_at);

COMMIT;
