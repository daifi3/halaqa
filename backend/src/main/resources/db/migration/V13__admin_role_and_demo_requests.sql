-- Halaqa admins create accounts (public sign-up is off) and handle demo requests from the landing page.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('teacher', 'student', 'admin'));

-- When the account was created; existing rows get the migration time.
ALTER TABLE users ADD COLUMN created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT NOW();

-- "Request a demo" from the landing page. An admin follows it up, takes payment outside the app,
-- then creates the teacher's account from it.
CREATE TABLE demo_requests (
    id            VARCHAR(255) PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    phone         VARCHAR(40),
    organization  VARCHAR(160),
    message       VARCHAR(1000),
    status        VARCHAR(32)  NOT NULL CHECK (status IN ('new', 'contacted', 'awaiting_payment', 'paid', 'account_created', 'declined')),
    admin_note    VARCHAR(1000),
    user_id       VARCHAR(255) REFERENCES users (id),
    created_at    TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at    TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_demo_requests_created ON demo_requests (created_at DESC);
CREATE INDEX idx_demo_requests_email ON demo_requests (LOWER(email));
