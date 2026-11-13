-- The teacher finalizes a graded attempt; the student is told their grade then.
ALTER TABLE exam_attempts ADD COLUMN finalized_at TIMESTAMP(6) WITH TIME ZONE;

-- In-app notifications (the bell): what happened, and the screen it leads to.
CREATE TABLE notifications (
    id           VARCHAR(255)  PRIMARY KEY,
    recipient_id VARCHAR(255)  NOT NULL REFERENCES users (id),
    kind         VARCHAR(40)   NOT NULL CHECK (kind IN ('exam_submitted', 'exam_graded')),
    title        VARCHAR(200)  NOT NULL,
    body         VARCHAR(500),
    link         VARCHAR(300),
    created_at   TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    read_at      TIMESTAMP(6) WITH TIME ZONE
);

CREATE INDEX idx_notifications_recipient ON notifications (recipient_id, created_at DESC);
