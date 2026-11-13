-- Phones that get push notifications (Expo push tokens), one row per app install.
CREATE TABLE push_tokens (
    token        VARCHAR(255) PRIMARY KEY,
    user_id      VARCHAR(255) NOT NULL REFERENCES users (id),
    platform     VARCHAR(20),
    -- Notification kinds the user turned off on that phone, comma separated.
    muted_kinds  VARCHAR(500) NOT NULL DEFAULT '',
    updated_at   TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_push_tokens_user ON push_tokens (user_id);
