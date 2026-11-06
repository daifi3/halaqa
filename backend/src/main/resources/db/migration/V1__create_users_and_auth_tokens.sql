CREATE TABLE users (
    id            VARCHAR(255) PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    role          VARCHAR(255) NOT NULL CHECK (role IN ('teacher', 'student')),
    password_hash VARCHAR(255) NOT NULL,
    avatar_url    VARCHAR(255)
);

-- findByEmailIgnoreCase runs on every log-in.
CREATE INDEX idx_users_email_lower ON users (LOWER(email));

CREATE TABLE auth_tokens (
    token      VARCHAR(255) PRIMARY KEY,
    user_id    VARCHAR(255) NOT NULL REFERENCES users (id),
    created_at TIMESTAMP(6) WITH TIME ZONE
);

CREATE INDEX idx_auth_tokens_user ON auth_tokens (user_id);
