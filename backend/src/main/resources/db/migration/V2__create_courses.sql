CREATE TABLE courses (
    id          VARCHAR(255) PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    subject     VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    join_code   VARCHAR(6)   NOT NULL UNIQUE,
    teacher_id  VARCHAR(255) NOT NULL REFERENCES users (id),
    created_at  TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_courses_teacher ON courses (teacher_id);

CREATE TABLE course_invites (
    course_id      VARCHAR(255) NOT NULL REFERENCES courses (id),
    invited_emails VARCHAR(255) NOT NULL,
    PRIMARY KEY (course_id, invited_emails)
);

CREATE INDEX idx_course_invites_email ON course_invites (invited_emails);

-- member_ids holds user ids; the entity maps them as plain strings, not a relation.
CREATE TABLE course_members (
    course_id  VARCHAR(255) NOT NULL REFERENCES courses (id),
    member_ids VARCHAR(255) NOT NULL,
    PRIMARY KEY (course_id, member_ids)
);

CREATE INDEX idx_course_members_member ON course_members (member_ids);
