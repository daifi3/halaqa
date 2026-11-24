-- Admins "delete" accounts by marking them deleted: the row, the person's classes, messages and
-- history stay, but the account can't sign in. An admin can restore it.
ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'deleted'));
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_users_status_created ON users (status, created_at DESC);
