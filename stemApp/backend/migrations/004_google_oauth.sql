-- Make password_hash nullable (Google OAuth users have no password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Store Google's immutable user identifier
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE users ADD CONSTRAINT users_google_sub_key UNIQUE (google_sub);

-- Track email verification status (Google users are pre-verified)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
