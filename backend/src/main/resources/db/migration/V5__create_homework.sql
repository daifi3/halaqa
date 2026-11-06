CREATE TABLE homework (
    id           VARCHAR(255)  PRIMARY KEY,
    course_id    VARCHAR(255)  NOT NULL REFERENCES courses (id),
    teacher_id   VARCHAR(255)  NOT NULL REFERENCES users (id),
    title        VARCHAR(120)  NOT NULL,
    instructions VARCHAR(4000),
    due_at       TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    created_at   TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_homework_course_due ON homework (course_id, due_at);
CREATE INDEX idx_homework_teacher ON homework (teacher_id);

CREATE TABLE homework_submissions (
    id                VARCHAR(255)  PRIMARY KEY,
    homework_id       VARCHAR(255)  NOT NULL REFERENCES homework (id),
    student_id        VARCHAR(255)  NOT NULL REFERENCES users (id),
    note              VARCHAR(4000),
    stored_filename   VARCHAR(255),
    original_filename VARCHAR(255),
    mime_type         VARCHAR(255),
    size_bytes        BIGINT,
    submitted_at      TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    UNIQUE (homework_id, student_id)
);

CREATE INDEX idx_homework_submissions_student ON homework_submissions (student_id);
CREATE INDEX idx_homework_submissions_stored_filename ON homework_submissions (stored_filename);
