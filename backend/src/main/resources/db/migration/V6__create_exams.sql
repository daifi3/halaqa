CREATE TABLE exams (
    id             VARCHAR(255)    PRIMARY KEY,
    course_id      VARCHAR(255)    NOT NULL REFERENCES courses (id),
    teacher_id     VARCHAR(255)    NOT NULL REFERENCES users (id),
    title          VARCHAR(120)    NOT NULL,
    instructions   VARCHAR(4000),
    duration_min   INTEGER         NOT NULL,
    opens_at       TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    closes_at      TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    show_results   BOOLEAN         NOT NULL,
    grade_scale    INTEGER         NOT NULL,
    questions_json VARCHAR(200000) NOT NULL,
    created_at     TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_exams_course_opens ON exams (course_id, opens_at);
CREATE INDEX idx_exams_teacher ON exams (teacher_id);

CREATE TABLE exam_attempts (
    id                  VARCHAR(255)    PRIMARY KEY,
    exam_id             VARCHAR(255)    NOT NULL REFERENCES exams (id),
    student_id          VARCHAR(255)    NOT NULL REFERENCES users (id),
    started_at          TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    finished_at         TIMESTAMP(6) WITH TIME ZONE,
    finish              VARCHAR(255)    CHECK (finish IN ('submitted', 'time_up', 'left')),
    answers_json        VARCHAR(200000) NOT NULL,
    written_grades_json VARCHAR(20000)  NOT NULL,
    UNIQUE (exam_id, student_id)
);

CREATE INDEX idx_exam_attempts_student ON exam_attempts (student_id);
