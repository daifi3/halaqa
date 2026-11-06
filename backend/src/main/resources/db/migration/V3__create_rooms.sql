CREATE TABLE rooms (
    id                VARCHAR(255) PRIMARY KEY,
    title             VARCHAR(255) NOT NULL,
    subject           VARCHAR(255) NOT NULL,
    starts_at         TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    duration_min      INTEGER      NOT NULL,
    join_code         VARCHAR(6)   NOT NULL UNIQUE,
    teacher_id        VARCHAR(255) NOT NULL REFERENCES users (id),
    course_id         VARCHAR(255) REFERENCES courses (id),
    status            VARCHAR(255) CHECK (status IN ('scheduled', 'live', 'ended')),
    active_egress_id  VARCHAR(255),
    screen_share_open BOOLEAN
);

CREATE INDEX idx_rooms_teacher ON rooms (teacher_id);
CREATE INDEX idx_rooms_course ON rooms (course_id);
CREATE INDEX idx_rooms_active_egress ON rooms (active_egress_id);

CREATE TABLE room_invites (
    room_id        VARCHAR(255) NOT NULL REFERENCES rooms (id),
    invited_emails VARCHAR(255) NOT NULL,
    PRIMARY KEY (room_id, invited_emails)
);

CREATE INDEX idx_room_invites_email ON room_invites (invited_emails);

CREATE TABLE room_members (
    room_id    VARCHAR(255) NOT NULL REFERENCES rooms (id),
    member_ids VARCHAR(255) NOT NULL,
    PRIMARY KEY (room_id, member_ids)
);

CREATE INDEX idx_room_members_member ON room_members (member_ids);

CREATE TABLE room_rsvps (
    room_id  VARCHAR(255) NOT NULL REFERENCES rooms (id),
    email    VARCHAR(255) NOT NULL,
    response VARCHAR(255) CHECK (response IN ('pending', 'accepted', 'declined')),
    PRIMARY KEY (room_id, email)
);

CREATE TABLE room_screen_grants (
    room_id             VARCHAR(255) NOT NULL REFERENCES rooms (id),
    screen_share_grants VARCHAR(255) NOT NULL,
    PRIMARY KEY (room_id, screen_share_grants)
);

CREATE TABLE room_messages (
    id        VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(40)  NOT NULL,
    room_id   VARCHAR(255) NOT NULL REFERENCES rooms (id),
    author_id VARCHAR(255) NOT NULL REFERENCES users (id),
    text      VARCHAR(500) NOT NULL,
    sent_at   TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    UNIQUE (room_id, client_id)
);

CREATE INDEX idx_room_messages_room_sent ON room_messages (room_id, sent_at);
CREATE INDEX idx_room_messages_author ON room_messages (author_id);
