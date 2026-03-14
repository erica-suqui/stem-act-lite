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
