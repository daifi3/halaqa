-- Access tokens now expire. Existing ones had no expiry and no refresh token to
-- go with them, so they expire straight away: those users sign in once more.
ALTER TABLE auth_tokens ADD COLUMN expires_at TIMESTAMP(6) WITH TIME ZONE;
UPDATE auth_tokens SET expires_at = CURRENT_TIMESTAMP;
ALTER TABLE auth_tokens ALTER COLUMN expires_at SET NOT NULL;

CREATE TABLE refresh_tokens (
    token      VARCHAR(255) PRIMARY KEY,
    user_id    VARCHAR(255) NOT NULL REFERENCES users (id),
    created_at TIMESTAMP(6) WITH TIME ZONE,
    expires_at TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
