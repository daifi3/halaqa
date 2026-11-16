-- Each user's own address book. A contact whose email belongs to a Halaqa account can be called.
CREATE TABLE contacts (
    id          VARCHAR(255) PRIMARY KEY,
    owner_id    VARCHAR(255) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        VARCHAR(120) NOT NULL,
    email       VARCHAR(255),
    phone       VARCHAR(40),
    note        VARCHAR(500),
    created_at  TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_contacts_owner ON contacts (owner_id, name);

-- Audio calls between two users, each in its own LiveKit room ("call-<id>").
CREATE TABLE calls (
    id           VARCHAR(255) PRIMARY KEY,
    caller_id    VARCHAR(255) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    callee_id    VARCHAR(255) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status       VARCHAR(20)  NOT NULL CHECK (status IN ('ringing', 'accepted', 'declined', 'missed', 'cancelled', 'ended')),
    created_at   TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    answered_at  TIMESTAMP(6) WITH TIME ZONE,
    ended_at     TIMESTAMP(6) WITH TIME ZONE
);

CREATE INDEX idx_calls_caller ON calls (caller_id, created_at DESC);
CREATE INDEX idx_calls_callee ON calls (callee_id, status, created_at DESC);
